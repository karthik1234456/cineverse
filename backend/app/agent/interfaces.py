from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class AgentMessage(BaseModel):
    role: str  # 'user', 'assistant', 'system', 'tool'
    content: str
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None


class UIAction(BaseModel):
    action: str  # 'navigate', 'open_3d_seat_pov', 'highlight_seats', 'show_confirmation_card', 'apply_coupon'
    params: Dict[str, Any] = {}


class ConfirmationCard(BaseModel):
    card_type: str  # 'HOLD_SEATS', 'CANCEL_BOOKING', 'ADD_SNACKS', 'PAYMENT_HANDOFF'
    title: str
    description: str
    details: Dict[str, Any]
    requires_tap_confirmation: bool = True
    action_token: str
    expires_at: Optional[str] = None


class AgentResponse(BaseModel):
    session_id: str
    reply_text: str
    language: str = "en"
    ui_actions: List[UIAction] = []
    confirmation_card: Optional[ConfirmationCard] = None
    spoken_audio_url: Optional[str] = None
    tool_calls_made: List[Dict[str, Any]] = []


class SpeechToTextProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_bytes: bytes, language: str = "en") -> str:
        """Transcribe speech audio into text."""
        pass


class TextToSpeechProvider(ABC):
    @abstractmethod
    async def synthesize(self, text: str, language: str = "en") -> Optional[bytes]:
        """Synthesize text into speech audio bytes."""
        pass


class LLMProvider(ABC):
    @abstractmethod
    async def generate_reply(
        self,
        messages: List[AgentMessage],
        tools: List[Dict[str, Any]],
        language: str = "en",
        user_context: Optional[Dict[str, Any]] = None
    ) -> AgentResponse:
        """Process messages and invoke appropriate tools or structured replies."""
        pass

