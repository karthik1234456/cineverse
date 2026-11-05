#!/usr/bin/env python3
"""
CI Check: No Bypasses (Phase 5 Tightening 9 & SECURITY_SPEC.md)

Verifies that no test-only signature strings, debug flags, or 'skip verification'
branches exist anywhere in production code.

Runs across backend/app and frontend/app & frontend/services.
Exits with code 1 if any forbidden bypass pattern is discovered.
"""

import sys
import re
from pathlib import Path

FORBIDDEN_PATTERNS = [
    r"test_signature_valid",
    r"skip_verification",
    r"bypass_payment",
    r"mock_signature_allow",
    r"allow_fake_signature",
    r"debug_payment_bypass",
    r"simulated_success_signature",
]

# Root directories to scan (production code only)
REPO_ROOT = Path(__file__).resolve().parent.parent.parent

PROD_SCAN_PATHS = [
    REPO_ROOT / "backend" / "app",
    REPO_ROOT / "frontend" / "app",
    REPO_ROOT / "frontend" / "services",
    REPO_ROOT / "frontend" / "components",
]

# Allowed file extensions
EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx"}


def scan_file(file_path: Path):
    violations = []
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        print(f"Warning: could not read {file_path}: {e}")
        return violations

    for line_num, line in enumerate(content.splitlines(), start=1):
        for pattern in FORBIDDEN_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                violations.append((file_path, line_num, pattern, line.strip()))
    return violations


def main():
    print("[CI CHECK] Scanning production directories for forbidden payment/security bypasses...")
    all_violations = []

    for scan_root in PROD_SCAN_PATHS:
        if not scan_root.exists():
            print(f"Skipping non-existent path: {scan_root}")
            continue

        for p in scan_root.rglob("*"):
            if p.is_file() and p.suffix in EXTENSIONS:
                # Exclude any test subdirectories if accidentally inside prod tree
                if "tests" in p.parts or "__tests__" in p.parts:
                    continue
                v = scan_file(p)
                if v:
                    all_violations.extend(v)

    if all_violations:
        print(f"\n[FAIL] Found {len(all_violations)} forbidden bypass pattern(s) in production code:")
        for path, line_no, pattern, line in all_violations:
            rel_path = path.relative_to(REPO_ROOT)
            print(f"  {rel_path}:{line_no} -> Matched '{pattern}': {line}")
        print("\nFix: Remove bypass strings from production code. Tests must generate real HMAC signatures using test secrets.")
        sys.exit(1)

    print(f"[CI CHECK] SUCCESS: Scanned {len(PROD_SCAN_PATHS)} production trees. 0 bypass patterns found.")
    sys.exit(0)


if __name__ == "__main__":
    main()
