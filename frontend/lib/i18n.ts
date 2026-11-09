/**
 * CineVerse Multilingual Localization Dictionary
 * Native translations for English, Hindi, Kannada, Tamil, and Telugu.
 */

export type SupportedLanguage = 'en' | 'hi' | 'kn' | 'ta' | 'te';

export interface TranslationDictionary {
  viewFromSeat: (seatId: string) => string;
  viewFromHere: string;
  greatView: string;
  goodView: string;
  okView: string;
  veryClose: string;
  farBack: string;
  seats: string;
  snacks: string;
  confirm: string;
  continueBtn: string;
  settings: string;
  peopleIllustrative: string;
  showPeople: string;
  lightingMode: string;
  lightsUp: string;
  showMode: string;
  quality: string;
  smooth: string;
  beautiful: string;
  tour: string;
  stopTour: string;
  tourCaptions: {
    overview: string;
    screen: string;
    front: string;
    premier: string;
    balcony: string;
    exits: string;
  };
}

export const I18N_DICTIONARY: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    viewFromSeat: (seatId) => `View from seat ${seatId}`,
    viewFromHere: 'View from here',
    greatView: 'Great view',
    goodView: 'Good view',
    okView: 'OK view',
    veryClose: 'Very close',
    farBack: 'Far back',
    seats: 'Seats',
    snacks: 'Snacks',
    confirm: 'Confirm',
    continueBtn: 'Continue to Snacks',
    settings: 'Settings',
    peopleIllustrative: 'People shown are illustrative',
    showPeople: 'Show audience',
    lightingMode: 'Auditorium lighting',
    lightsUp: 'Lights up',
    showMode: 'Show (Trailer)',
    quality: 'Visual quality',
    smooth: 'Smooth (60 FPS)',
    beautiful: 'Beautiful',
    tour: 'Guided Tour',
    stopTour: 'Stop Tour',
    tourCaptions: {
      overview: 'Auditorium Overview: Full hall geometry and sightlines',
      screen: 'Stage & Screen: Giant sound-transparent canvas',
      front: 'Front Rows: Immersive front-stall perspective',
      premier: 'Premier Centre: Optimal viewing angle and distance',
      balcony: 'Balcony Tier: Elevated panoramic viewing',
      exits: 'Wayfinding & Exits: Emergency egress and aisle routing',
    },
  },
  hi: {
    viewFromSeat: (seatId) => `सीट ${seatId} से दृश्य`,
    viewFromHere: 'यहाँ से देखें',
    greatView: 'उत्कृष्ट दृश्य',
    goodView: 'अच्छा दृश्य',
    okView: 'सामान्य दृश्य',
    veryClose: 'बहुत नज़दीक',
    farBack: 'बहुत पीछे',
    seats: 'सीटें',
    snacks: 'स्नैक्स',
    confirm: 'पुष्टि करें',
    continueBtn: 'स्नैक्स के लिए आगे बढ़ें',
    settings: 'सेटिंग्स',
    peopleIllustrative: 'दिखाए गए दर्शक केवल सांकेतिक हैं',
    showPeople: 'दर्शक दिखाएं',
    lightingMode: 'सिनेमा हॉल लाइटिंग',
    lightsUp: 'पूरी रोशनी',
    showMode: 'शो मोड (ट्रेलर)',
    quality: 'ग्राफ़िक्स गुणवत्ता',
    smooth: 'स्मूथ (60 FPS)',
    beautiful: 'हाई क्वालिटी',
    tour: 'गाइडेड टूर',
    stopTour: 'टूर रोकें',
    tourCaptions: {
      overview: 'सभागार अवलोकन: पूरी हॉल बनावट और दृष्टि कोण',
      screen: 'विशाल स्क्रीन: ध्वनि-पारदर्शी स्क्रीन और मंच',
      front: 'सामने की पंक्तियाँ: निकटवर्ती विहंगम दृश्य',
      premier: 'प्रीमियर केंद्र: सबसे संतुलित दृश्य और दूरी',
      balcony: 'बालकनी स्तर: ऊपरी स्तर से विहंगम दृश्य',
      exits: 'निकास मार्ग: सुरक्षित गलियारा और आपातकालीन निकास',
    },
  },
  kn: {
    viewFromSeat: (seatId) => `${seatId} ಆಸನದಿಂದ ನೋಟ`,
    viewFromHere: 'ಇಲ್ಲಿಂದ ನೋಡಿ',
    greatView: 'ಅತ್ಯುತ್ತಮ ನೋಟ',
    goodView: 'ಉತ್ತಮ ನೋಟ',
    okView: 'ಸಾಮಾನ್ಯ ನೋಟ',
    veryClose: 'ತುಂಬಾ ಹತ್ತಿರ',
    farBack: 'ತುಂಬಾ ಹಿಂದೆ',
    seats: 'ಆಸನಗಳು',
    snacks: 'ತಿಂಡಿಗಳು',
    confirm: 'ಖಚಿತಪಡಿಸಿ',
    continueBtn: 'ತಿಂಡಿಗಳಿಗೆ ಮುಂದುವರಿಯಿರಿ',
    settings: 'ಸೆಟ್ಟಿಂಗ್ಸ್',
    peopleIllustrative: 'ತೋರಿಸಿರುವ ಪ್ರೇಕ್ಷಕರು ಸಾಂಕೇತಿಕ ಮಾತ್ರ',
    showPeople: 'ಪ್ರೇಕ್ಷಕರನ್ನು ತೋರಿಸಿ',
    lightingMode: 'ಚಿತ್ರಮಂದಿರದ ಬೆಳಕು',
    lightsUp: 'ಪೂರ್ಣ ಬೆಳಕು',
    showMode: 'ಶೋ ಮೋಡ್ (ಟ್ರೇಲರ್)',
    quality: 'ದೃಶ್ಯ ಗುಣಮಟ್ಟ',
    smooth: 'ಸ್ಮೂತ್ (60 FPS)',
    beautiful: 'ಉತ್ತಮ ಗುಣಮಟ್ಟ',
    tour: 'ಚಿತ್ರಮಂದಿರ ವೀಕ್ಷಣೆ',
    stopTour: 'ವೀಕ್ಷಣೆ ನಿಲ್ಲಿಸಿ',
    tourCaptions: {
      overview: 'ಚಿತ್ರಮಂದಿರದ ಅವಲೋಕನ: ಪೂರ್ಣ ಸಭಾಂಗಣ ಮತ್ತು ನೋಟ ಕೋನಗಳು',
      screen: 'ದೊಡ್ಡ ಪರದೆ: ಧ್ವನಿ-ಪಾರದರ್ಶಕ ಪರದೆ ಮತ್ತು ವೇದಿಕೆ',
      front: 'ಮುಂಭಾಗದ ಸಾಲುಗಳು: ನಿಕಟ ದೃಶ್ಯ ನೋಟ',
      premier: 'ಪ್ರೀಮಿಯರ್ ಮಧ್ಯಭಾಗ: ಅತ್ಯುತ್ತಮ ಸಮತೋಲಿತ ನೋಟ ಮತ್ತು ದೂರ',
      balcony: 'ಬಾಲ್ಕನಿ ಹಂತ: ಎತ್ತರದ ವಿಹಂಗಮ ನೋಟ',
      exits: 'ನಿರ್ಗಮನ ಮಾರ್ಗಗಳು: ಸುರಕ್ಷಿತ ನಿರ್ಗಮನ ಮತ್ತು ದಾರಿಗಳು',
    },
  },
  ta: {
    viewFromSeat: (seatId) => `இருக்கை ${seatId} பார்வை`,
    viewFromHere: 'இங்கிருந்து பார்க்கவும்',
    greatView: 'சிறந்த பார்வை',
    goodView: 'நல்ல பார்வை',
    okView: 'சாதாரண பார்வை',
    veryClose: 'மிக அருகில்',
    farBack: 'மிக பின்னால்',
    seats: 'இருக்கைகள்',
    snacks: 'சிற்றுண்டி',
    confirm: 'உறுதிப்படுத்துக',
    continueBtn: 'சிற்றுண்டிக்கு தொடரவும்',
    settings: 'அமைப்புகள்',
    peopleIllustrative: 'காட்டப்படும் பார்வையாளர்கள் மாதிரி மட்டுமே',
    showPeople: 'பார்வையாளர்களைக் காட்டு',
    lightingMode: 'அரங்க விளக்குகள்',
    lightsUp: 'முழு வெளிச்சம்',
    showMode: 'திரைப்படம் (டிரெய்லர்)',
    quality: 'காட்சி தரம்',
    smooth: 'மென்மையானது (60 FPS)',
    beautiful: 'உயர்ந்த தரம்',
    tour: 'வழிகாட்டப்பட்ட சுற்றுலா',
    stopTour: 'நிறுத்து',
    tourCaptions: {
      overview: 'அரங்க மேலோட்டம்: முழு அரங்கம் மற்றும் பார்வை கோணங்கள்',
      screen: 'பெரிய திரை: ஒலி-புகும் திரை மற்றும் மேடை',
      front: 'முன் வரிசைகள்: நெருக்கமான பார்வை',
      premier: 'பிரீமியர் மையம்: சிறந்த பார்வை கோணம் மற்றும் தூரம்',
      balcony: 'பால்கனி தளம்: உயரமான பரந்த பார்வை',
      exits: 'வெளியேறும் வழிகள்: அவசரகால வெளியேற்றம்',
    },
  },
  te: {
    viewFromSeat: (seatId) => `సీటు ${seatId} నుండి వీక్షణ`,
    viewFromHere: 'ఇక్కడ నుండి చూడండి',
    greatView: 'అద్భుతమైన వీక్షణ',
    goodView: 'మంచి వీక్షణ',
    okView: 'సాధారణ వీక్షణ',
    veryClose: 'చాలా దగ్గరగా',
    farBack: 'చాలా వెనుక',
    seats: 'సీట్లు',
    snacks: 'స్నాక్స్',
    confirm: 'ధృవీకరించండి',
    continueBtn: 'స్నాక్స్ కోసం కొనసాగించండి',
    settings: 'సెట్టింగ్‌లు',
    peopleIllustrative: 'చూపించిన ప్రేక్షకులు నమూనా మాత్రమే',
    showPeople: 'ప్రేక్షకులను చూపించు',
    lightingMode: 'ఆడిటోరియం లైటింగ్',
    lightsUp: 'పూర్తి వెలుతురు',
    showMode: 'షో మోడ్ (ట్రైలర్)',
    quality: 'విజువల్ నాణ్యత',
    smooth: 'స్మూత్ (60 FPS)',
    beautiful: 'ఉత్తమ నాణ్యత',
    tour: 'గైడెడ్ టూర్',
    stopTour: 'టూర్ ఆపండి',
    tourCaptions: {
      overview: 'ఆడిటోరియం అవలోకనం: మొత్తం హాల్ అమరిక మరియు వీక్షణలు',
      screen: 'భారీ స్క్రీన్: ధ్వని-పారదర్శక స్క్రీన్ మరియు వేదిక',
      front: 'ముందు వరుసలు: స్పష్టమైన సమీప వీక్షణ',
      premier: 'ప్రీమియర్ సెంటర్: ఉత్తమ సమతుల్య వీక్షణ మరియు దూరం',
      balcony: 'బాల్కనీ అంచె: ఎత్తైన విస్తృత వీక్షణ',
      exits: 'నిష్క్రమణ మార్గాలు: అత్యవసర నిష్క్రమణలు',
    },
  },
};

