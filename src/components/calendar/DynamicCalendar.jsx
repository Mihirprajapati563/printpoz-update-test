import React from "react";
import { useSelector } from "react-redux";
import { getCalendarSettings } from "../../library/utils/helpers";
import { getMonthYear } from "../../library/utils/common-functions";
import { useLiveResize } from "../canvas/liveResizeStore";

// dynamic day names
const dayNameMappings = {
  en: [
    { tinyName: "S", shortName: "Sun", fullName: "Sunday" },
    { tinyName: "M", shortName: "Mon", fullName: "Monday" },
    { tinyName: "T", shortName: "Tue", fullName: "Tuesday" },
    { tinyName: "W", shortName: "Wed", fullName: "Wednesday" },
    { tinyName: "T", shortName: "Thu", fullName: "Thursday" },
    { tinyName: "F", shortName: "Fri", fullName: "Friday" },
    { tinyName: "S", shortName: "Sat", fullName: "Saturday" },
  ],
  gj: [
    { tinyName: "ર", shortName: "રવિ", fullName: "રવિવાર" },
    { tinyName: "સો", shortName: "સોમ", fullName: "સોમવાર" },
    { tinyName: "મં", shortName: "મંગળ", fullName: "મંગળવાર" },
    { tinyName: "બુ", shortName: "બુધ", fullName: "બુધવાર" },
    { tinyName: "ગુ", shortName: "ગુરુ", fullName: "ગુરુવાર" },
    { tinyName: "શુ", shortName: "શુક્ર", fullName: "શુક્રવાર" },
    { tinyName: "શ", shortName: "શનિ", fullName: "શનિવાર" },
  ],
  hi: [
    { tinyName: "र", shortName: "रवि", fullName: "रविवार" },
    { tinyName: "सो", shortName: "सोम", fullName: "सोमवार" },
    { tinyName: "मं", shortName: "मंगल", fullName: "मंगलवार" },
    { tinyName: "बु", shortName: "बुध", fullName: "बुधवार" },
    { tinyName: "गु", shortName: "गुरु", fullName: "गुरुवार" },
    { tinyName: "शु", shortName: "शुक्र", fullName: "शुक्रवार" },
    { tinyName: "श", shortName: "शनि", fullName: "शनिवार" },
  ],
  mr: [
    { tinyName: "र", shortName: "रवि", fullName: "रविवार" },
    { tinyName: "सो", shortName: "सोम", fullName: "सोमवार" },
    { tinyName: "मं", shortName: "मंगळ", fullName: "मंगळवार" },
    { tinyName: "बु", shortName: "बुध", fullName: "बुधवार" },
    { tinyName: "गु", shortName: "गुरु", fullName: "गुरुवार" },
    { tinyName: "शु", shortName: "शुक्र", fullName: "शुक्रवार" },
    { tinyName: "श", shortName: "शनि", fullName: "शनिवार" },
  ],
  bn: [
    { tinyName: "র", shortName: "রবি", fullName: "রবিবার" },
    { tinyName: "সো", shortName: "সোম", fullName: "সোমবার" },
    { tinyName: "মং", shortName: "মঙ্গল", fullName: "মঙ্গলবার" },
    { tinyName: "বু", shortName: "বুধ", fullName: "বুধবার" },
    { tinyName: "ব্র", shortName: "বৃহস্পতি", fullName: "বৃহস্পতিবার" },
    { tinyName: "শু", shortName: "শুক্র", fullName: "শুক্রবার" },
    { tinyName: "শ", shortName: "শনি", fullName: "শনিবার" },
  ],
  ta: [
    { tinyName: "ஞா", shortName: "ஞாயிறு", fullName: "ஞாயிறு" },
    { tinyName: "தி", shortName: "திங்கள்", fullName: "திங்கள்" },
    { tinyName: "செ", shortName: "செவ்வாய்", fullName: "செவ்வாய்" },
    { tinyName: "பு", shortName: "புதன்", fullName: "புதன்" },
    { tinyName: "வி", shortName: "வியாழன்", fullName: "வியாழன்" },
    { tinyName: "வெ", shortName: "வெள்ளி", fullName: "வெள்ளி" },
    { tinyName: "ச", shortName: "சனி", fullName: "சனி" },
  ],
  te: [
    { tinyName: "ఆ", shortName: "ఆది", fullName: "ఆదివారం" },
    { tinyName: "సో", shortName: "సోమ", fullName: "సోమవారం" },
    { tinyName: "మం", shortName: "మంగళ", fullName: "మంగళవారం" },
    { tinyName: "బు", shortName: "బుధ", fullName: "బుధవారం" },
    { tinyName: "గు", shortName: "గురు", fullName: "గురువారం" },
    { tinyName: "శు", shortName: "శుక్ర", fullName: "శుక్రవారం" },
    { tinyName: "శ", shortName: "శని", fullName: "శనివారం" },
  ],
  kn: [
    { tinyName: "ಭಾ", shortName: "ಭಾನು", fullName: "ಭಾನುವಾರ" },
    { tinyName: "ಸೋ", shortName: "ಸೋಮ", fullName: "ಸೋಮವಾರ" },
    { tinyName: "ಮಂ", shortName: "ಮಂಗಳ", fullName: "ಮಂಗಳವಾರ" },
    { tinyName: "ಬು", shortName: "ಬುಧ", fullName: "ಬುಧವಾರ" },
    { tinyName: "ಗು", shortName: "ಗುರು", fullName: "ಗುರುವಾರ" },
    { tinyName: "ಶು", shortName: "ಶುಕ್ರ", fullName: "ಶುಕ್ರವಾರ" },
    { tinyName: "ಶ", shortName: "ಶನಿ", fullName: "ಶನಿವಾರ" },
  ],
  ml: [
    { tinyName: "ഞാ", shortName: "ഞായര്", fullName: "ഞായര്" },
    { tinyName: "തി", shortName: "തിങ്കൾ", fullName: "തിങ്കൾ" },
    { tinyName: "ചെ", shortName: "ചൊവ്വ", fullName: "ചൊവ്വ" },
    { tinyName: "ബു", shortName: "ബുധൻ", fullName: "ബുധൻ" },
    { tinyName: "വി", shortName: "വ്യാഴം", fullName: "വ്യാഴം" },
    { tinyName: "വെ", shortName: "വെള്ളി", fullName: "വെള്ളി" },
    { tinyName: "ശ", shortName: "ശനി", fullName: "ശനി" },
  ],
  pa: [
    { tinyName: "ਐ", shortName: "ਐਤ", fullName: "ਐਤਵਾਰ" },
    { tinyName: "ਸੋ", shortName: "ਸੋਮ", fullName: "ਸੋਮਵਾਰ" },
    { tinyName: "ਮੰ", shortName: "ਮੰਗਲ", fullName: "ਮੰਗਲਵਾਰ" },
    { tinyName: "ਬੁ", shortName: "ਬੁਧ", fullName: "ਬੁਧਵਾਰ" },
    { tinyName: "ਵੀ", shortName: "ਵੀਰ", fullName: "ਵੀਰਵਾਰ" },
    { tinyName: "ਸੁ", shortName: "ਸੁਖ", fullName: "ਸੁਖਰਵਾਰ" },
    { tinyName: "ਸ", shortName: "ਸ਼ਨਿ", fullName: "ਸ਼ਨਿਵਾਰ" },
  ],
  or: [
    { tinyName: "ର", shortName: "ରବି", fullName: "ରବିବାର" },
    { tinyName: "ସୋ", shortName: "ସୋମ", fullName: "ସୋମବାର" },
    { tinyName: "ମ", shortName: "ମଙ୍ଗଳ", fullName: "ମଙ୍ଗଳବାର" },
    { tinyName: "ବୁ", shortName: "ବୁଧ", fullName: "ବୁଧବାର" },
    { tinyName: "ଗୁ", shortName: "ଗୁରୁ", fullName: "ଗୁରୁବାର" },
    { tinyName: "ଶୁ", shortName: "ଶୁକ୍ର", fullName: "ଶୁକ୍ରବାର" },
    { tinyName: "ଶ", shortName: "ଶନି", fullName: "ଶନିବାର" },
  ],
  gu: [
    { tinyName: "ર", shortName: "રવિ", fullName: "રવિવાર" },
    { tinyName: "સો", shortName: "સોમ", fullName: "સોમવાર" },
    { tinyName: "મં", shortName: "મંગળ", fullName: "મંગળવાર" },
    { tinyName: "બુ", shortName: "બુધ", fullName: "બુધવાર" },
    { tinyName: "ગુ", shortName: "ગુરુ", fullName: "ગુરુવાર" },
    { tinyName: "શુ", shortName: "શુક્ર", fullName: "શુક્રવાર" },
    { tinyName: "શ", shortName: "શનિ", fullName: "શનિવાર" },
  ],
  as: [
    { tinyName: "ৰ", shortName: "ৰবি", fullName: "ৰবিবাৰ" },
    { tinyName: "স", shortName: "সোম", fullName: "সোমবাৰ" },
    { tinyName: "ম", shortName: "মঙ্গল", fullName: "মঙ্গলবাৰ" },
    { tinyName: "ব", shortName: "বুধ", fullName: "বুধবাৰ" },
    { tinyName: "বৃ", shortName: "বৃহস্পতি", fullName: "বৃহস্পতিবাৰ" },
    { tinyName: "শু", shortName: "শুক্ৰ", fullName: "শুক্ৰবাৰ" },
    { tinyName: "শ", shortName: "শনি", fullName: "শনিবাৰ" },
  ],
};

// function to get day names
const getDayNames = (lang = "en") => {
  return dayNameMappings[lang] || dayNameMappings["en"];
};
// month name mappings for all languages
const monthNameMappings = {
  en: [
    { shortName: "Jan", fullName: "January" },
    { shortName: "Feb", fullName: "February" },
    { shortName: "Mar", fullName: "March" },
    { shortName: "Apr", fullName: "April" },
    { shortName: "May", fullName: "May" },
    { shortName: "Jun", fullName: "June" },
    { shortName: "Jul", fullName: "July" },
    { shortName: "Aug", fullName: "August" },
    { shortName: "Sep", fullName: "September" },
    { shortName: "Oct", fullName: "October" },
    { shortName: "Nov", fullName: "November" },
    { shortName: "Dec", fullName: "December" },
  ],
  gj: [
    { shortName: "જાન્યુ", fullName: "જાન્યુઆરી" },
    { shortName: "ફેબ્રુ", fullName: "ફેબ્રુઆરી" },
    { shortName: "માર્ચ", fullName: "માર્ચ" },
    { shortName: "એપ્રિલ", fullName: "એપ્રિલ" },
    { shortName: "મે", fullName: "મે" },
    { shortName: "જૂન", fullName: "જૂન" },
    { shortName: "જુલાઈ", fullName: "જુલાઈ" },
    { shortName: "ઓગસ્ટ", fullName: "ઓગસ્ટ" },
    { shortName: "સપ્ટે", fullName: "સપ્ટેમ્બર" },
    { shortName: "ઓક્ટો", fullName: "ઓક્ટોબર" },
    { shortName: "નવે", fullName: "નવેમ્બર" },
    { shortName: "ડિસે", fullName: "ડિસેમ્બર" },
  ],
  gu: [
    { shortName: "જાન્યુ", fullName: "જાન્યુઆરી" },
    { shortName: "ફેબ્રુ", fullName: "ફેબ્રુઆરી" },
    { shortName: "માર્ચ", fullName: "માર્ચ" },
    { shortName: "એપ્રિલ", fullName: "એપ્રિલ" },
    { shortName: "મે", fullName: "મે" },
    { shortName: "જૂન", fullName: "જૂન" },
    { shortName: "જુલાઈ", fullName: "જુલાઈ" },
    { shortName: "ઓગસ્ટ", fullName: "ઓગસ્ટ" },
    { shortName: "સપ્ટે", fullName: "સપ્ટેમ્બર" },
    { shortName: "ઓક્ટો", fullName: "ઓક્ટોબર" },
    { shortName: "નવે", fullName: "નવેમ્બર" },
    { shortName: "ડિસે", fullName: "ડિસેમ્બર" },
  ],
  hi: [
    { shortName: "जन", fullName: "जनवरी" },
    { shortName: "फर", fullName: "फरवरी" },
    { shortName: "मार्च", fullName: "मार्च" },
    { shortName: "अप्रैल", fullName: "अप्रैल" },
    { shortName: "मई", fullName: "मई" },
    { shortName: "जून", fullName: "जून" },
    { shortName: "जुला", fullName: "जुलाई" },
    { shortName: "अग", fullName: "अगस्त" },
    { shortName: "सित", fullName: "सितंबर" },
    { shortName: "अक्टू", fullName: "अक्टूबर" },
    { shortName: "नव", fullName: "नवंबर" },
    { shortName: "दिस", fullName: "दिसंबर" },
  ],
  mr: [
    { shortName: "जाने", fullName: "जानेवारी" },
    { shortName: "फेब्रु", fullName: "फेब्रुवारी" },
    { shortName: "मार्च", fullName: "मार्च" },
    { shortName: "एप्रि", fullName: "एप्रिल" },
    { shortName: "मे", fullName: "मे" },
    { shortName: "जून", fullName: "जून" },
    { shortName: "जुलै", fullName: "जुलै" },
    { shortName: "ऑग", fullName: "ऑगस्ट" },
    { shortName: "सप्टें", fullName: "सप्टेंबर" },
    { shortName: "ऑक्टो", fullName: "ऑक्टोबर" },
    { shortName: "नोव्हें", fullName: "नोव्हेंबर" },
    { shortName: "डिसें", fullName: "डिसेंबर" },
  ],
  bn: [
    { shortName: "জানু", fullName: "জানুয়ারি" },
    { shortName: "ফেব্রু", fullName: "ফেব্রুয়ারি" },
    { shortName: "মার্চ", fullName: "মার্চ" },
    { shortName: "এপ্রি", fullName: "এপ্রিল" },
    { shortName: "মে", fullName: "মে" },
    { shortName: "জুন", fullName: "জুন" },
    { shortName: "জুলা", fullName: "জুলাই" },
    { shortName: "আগ", fullName: "আগস্ট" },
    { shortName: "সেপ্টে", fullName: "সেপ্টেম্বর" },
    { shortName: "অক্টো", fullName: "অক্টোবর" },
    { shortName: "নভে", fullName: "নভেম্বর" },
    { shortName: "ডিসে", fullName: "ডিসেম্বর" },
  ],
  ta: [
    { shortName: "ஜன", fullName: "ஜனவரி" },
    { shortName: "பிப்", fullName: "பிப்ரவரி" },
    { shortName: "மார்", fullName: "மார்ச்" },
    { shortName: "ஏப்", fullName: "ஏப்ரல்" },
    { shortName: "மே", fullName: "மே" },
    { shortName: "ஜூன்", fullName: "ஜூன்" },
    { shortName: "ஜூலை", fullName: "ஜூலை" },
    { shortName: "ஆக", fullName: "ஆகஸ்ட்" },
    { shortName: "செப்", fullName: "செப்டம்பர்" },
    { shortName: "அக்", fullName: "அக்டோபர்" },
    { shortName: "நவ", fullName: "நவம்பர்" },
    { shortName: "டிச", fullName: "டிசம்பர்" },
  ],
  te: [
    { shortName: "జన", fullName: "జనవరి" },
    { shortName: "ఫిబ్ర", fullName: "ఫిబ్రవరి" },
    { shortName: "మార్చి", fullName: "మార్చి" },
    { shortName: "ఏప్రి", fullName: "ఏప్రిల్" },
    { shortName: "మే", fullName: "మే" },
    { shortName: "జూన్", fullName: "జూన్" },
    { shortName: "జూలై", fullName: "జూలై" },
    { shortName: "ఆగ", fullName: "ఆగస్టు" },
    { shortName: "సెప్టె", fullName: "సెప్టెంబర్" },
    { shortName: "అక్టో", fullName: "అక్టోబర్" },
    { shortName: "నవం", fullName: "నవంబర్" },
    { shortName: "డిసెం", fullName: "డిసెంబర్" },
  ],
  kn: [
    { shortName: "ಜನ", fullName: "ಜನವರಿ" },
    { shortName: "ಫೆಬ್ರ", fullName: "ಫೆಬ್ರವರಿ" },
    { shortName: "ಮಾರ್ಚ್", fullName: "ಮಾರ್ಚ್" },
    { shortName: "ಏಪ್ರಿ", fullName: "ಏಪ್ರಿಲ್" },
    { shortName: "ಮೇ", fullName: "ಮೇ" },
    { shortName: "ಜೂನ್", fullName: "ಜೂನ್" },
    { shortName: "ಜುಲೈ", fullName: "ಜುಲೈ" },
    { shortName: "ಆಗ", fullName: "ಆಗಸ್ಟ್" },
    { shortName: "ಸೆಪ್ಟೆಂ", fullName: "ಸೆಪ್ಟೆಂಬರ್" },
    { shortName: "ಅಕ್ಟೋ", fullName: "ಅಕ್ಟೋಬರ್" },
    { shortName: "ನವೆಂ", fullName: "ನವೆಂಬರ್" },
    { shortName: "ಡಿಸೆಂ", fullName: "ಡಿಸೆಂಬರ್" },
  ],
  ml: [
    { shortName: "ജനു", fullName: "ജനുവരി" },
    { shortName: "ഫെബ്രു", fullName: "ഫെബ്രുവരി" },
    { shortName: "മാർച്ച്", fullName: "മാർച്ച്" },
    { shortName: "ഏപ്രി", fullName: "ഏപ്രിൽ" },
    { shortName: "മേയ്", fullName: "മേയ്" },
    { shortName: "ജൂൺ", fullName: "ജൂൺ" },
    { shortName: "ജൂലൈ", fullName: "ജൂലൈ" },
    { shortName: "ഓഗ", fullName: "ഓഗസ്റ്റ്" },
    { shortName: "സെപ്റ്റം", fullName: "സെപ്റ്റംബർ" },
    { shortName: "ഒക്ടോ", fullName: "ഒക്ടോബർ" },
    { shortName: "നവം", fullName: "നവംബർ" },
    { shortName: "ഡിസം", fullName: "ഡിസംബർ" },
  ],
  pa: [
    { shortName: "ਜਨ", fullName: "ਜਨਵਰੀ" },
    { shortName: "ਫਰ", fullName: "ਫਰਵਰੀ" },
    { shortName: "ਮਾਰਚ", fullName: "ਮਾਰਚ" },
    { shortName: "ਅਪ੍ਰੈ", fullName: "ਅਪ੍ਰੈਲ" },
    { shortName: "ਮਈ", fullName: "ਮਈ" },
    { shortName: "ਜੂਨ", fullName: "ਜੂਨ" },
    { shortName: "ਜੁਲਾ", fullName: "ਜੁਲਾਈ" },
    { shortName: "ਅਗ", fullName: "ਅਗਸਤ" },
    { shortName: "ਸਤੰ", fullName: "ਸਤੰਬਰ" },
    { shortName: "ਅਕਤੂ", fullName: "ਅਕਤੂਬਰ" },
    { shortName: "ਨਵੰ", fullName: "ਨਵੰਬਰ" },
    { shortName: "ਦਸੰ", fullName: "ਦਸੰਬਰ" },
  ],
  or: [
    { shortName: "ଜାନୁ", fullName: "ଜାନୁଆରୀ" },
    { shortName: "ଫେବ୍ରୁ", fullName: "ଫେବ୍ରୁଆରୀ" },
    { shortName: "ମାର୍ଚ୍ଚ", fullName: "ମାର୍ଚ୍ଚ" },
    { shortName: "ଏପ୍ରି", fullName: "ଏପ୍ରିଲ" },
    { shortName: "ମେ", fullName: "ମେ" },
    { shortName: "ଜୁନ", fullName: "ଜୁନ" },
    { shortName: "ଜୁଲାଇ", fullName: "ଜୁଲାଇ" },
    { shortName: "ଅଗ", fullName: "ଅଗଷ୍ଟ" },
    { shortName: "ସେପ୍ଟେ", fullName: "ସେପ୍ଟେମ୍ବର" },
    { shortName: "ଅକ୍ଟୋ", fullName: "ଅକ୍ଟୋବର" },
    { shortName: "ନଭେ", fullName: "ନଭେମ୍ବର" },
    { shortName: "ଡିସେ", fullName: "ଡିସେମ୍ବର" },
  ],
  as: [
    { shortName: "জানু", fullName: "জানুৱাৰী" },
    { shortName: "ফেব্ৰু", fullName: "ফেব্ৰুৱাৰী" },
    { shortName: "মাৰ্চ", fullName: "মাৰ্চ" },
    { shortName: "এপ্ৰি", fullName: "এপ্ৰিল" },
    { shortName: "মে", fullName: "মে" },
    { shortName: "জুন", fullName: "জুন" },
    { shortName: "জুলা", fullName: "জুলাই" },
    { shortName: "আগ", fullName: "আগষ্ট" },
    { shortName: "ছেপ্টে", fullName: "ছেপ্টেম্বৰ" },
    { shortName: "অক্টো", fullName: "অক্টোবৰ" },
    { shortName: "নৱে", fullName: "নৱেম্বৰ" },
    { shortName: "ডিচে", fullName: "ডিচেম্বৰ" },
  ],
};

// function to get month name in language
const getMonthName = (monthIndex, lang = "en", format = "full") => {
  const months = monthNameMappings[lang] || monthNameMappings["en"];
  if (!monthIndex || monthIndex < 1 || monthIndex > 12) return "";
  const month = months[monthIndex - 1];
  return format === "short" ? month.shortName : month.fullName;
};

// function to get number in language
const numberMappings = {
  gj: ["૦", "૧", "૨", "૩", "૪", "૫", "૬", "૭", "૮", "૯"], // Gujarati
  hi: ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"], // Hindi
  mr: ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"], // Marathi
  en: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], // English
  bn: ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"], // Bengali
  ta: ["௦", "௧", "௨", "௩", "௪", "௫", "௬", "௭", "௮", "௯"], // Tamil
  te: ["౦", "౧", "౨", "౩", "౪", "౫", "౬", "౭", "౮", "౯"], // Telugu
  kn: ["೦", "೧", "೨", "೩", "೪", "೫", "೬", "೭", "೮", "೯"], // Kannada
  ml: ["൦", "൧", "൨", "൩", "൪", "൫", "൬", "൭", "൮", "൯"], // Malayalam
  pa: ["੦", "੧", "੨", "੩", "੪", "੫", "੬", "੭", "੮", "੯"], // Punjabi
  or: ["୦", "୧", "୨", "୩", "୪", "୫", "୬", "୭", "୮", "୯"], // Oriya
  gu: ["૦", "૧", "૨", "૩", "૪", "૫", "૬", "૭", "૮", "૯"], // Gujarati
  as: ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"], // Assamese
  // Add more languages here if needed
};
const convertNumberToLanguage = (number, lang) => {
  if (!numberMappings[lang]) {
    return number.toString(); // Default to English if language is not supported
  }

  return number
    .toString()
    .split("")
    .map((digit) => numberMappings[lang][digit])
    .join("");
};

// function to generate calendar data
const generateCalendarData = (month, year) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDay = new Date(year, month - 1, 1).getDay();
  const weeks = [];

  let currentDay = 1;
  for (let week = 0; currentDay <= daysInMonth; week++) {
    weeks[week] = [];
    for (let day = 0; day < 7; day++) {
      if (week === 0 && day < startDay) {
        weeks[week].push(null); // Empty cell
      } else if (currentDay <= daysInMonth) {
        weeks[week].push(currentDay++);
      } else {
        weeks[week].push(null); // Empty cell
      }
    }
  }
  return weeks;
};

const DynamicCalendar = ({
  item: rawItem,
  pageIndex,
  calIndex = 1,
  calendarCount = 1,
  calendarMonthOffset,
  width: widthProp,
  height: heightProp,
  borderColor = "#000000",
  alternateColor = "#f0f0f0",
  headerColor = "#cccccc",
  headerTextColor = "#000000",
  textColor = "#000000",
  fontSize = 40,
}) => {
  // Live-resize override (no redux dispatch during the gesture → no MainCanvas
  // re-render). Merged over the redux item so the grid reflows at the live size;
  // width/height keep their original default-from-item semantics otherwise.
  const liveResize = useLiveResize(rawItem?.id);
  const item = liveResize ? { ...rawItem, ...liveResize } : rawItem;
  const width = liveResize?.width ?? (widthProp != null ? widthProp : (item.width || 1000));
  const height = liveResize?.height ?? (heightProp != null ? heightProp : (item.height || 1000));
  const globalCalSettings = useSelector(getCalendarSettings);
  // Merge: object-specific settings (persisted) override global/ephemeral settings
  const calendarSetings = {
    ...globalCalSettings,
    ...Object.fromEntries(
      Object.entries(item?.calendarSettings || {}).filter(
        ([, v]) => v !== "" && v !== null && v !== undefined
      )
    ),
  };
  const weeksColumns = calendarSetings.weeksColumns || 1;
  const cellMargin = calendarSetings.cellMargin
    ? calendarSetings.cellMargin
    : 0;
  const startMonth = parseInt(calendarSetings.startMonth);
  const startYear = parseInt(calendarSetings.startYear);
  const monthOffsetUsed = calendarMonthOffset !== undefined ? calendarMonthOffset : pageIndex * calendarCount + (calIndex - 1);
  const { month, year } = getMonthYear(startMonth, startYear, monthOffsetUsed);
  const weeks = generateCalendarData(
    month,
    year,
    calendarSetings.language ? calendarSetings.language : "en"
  );
  const dayNames = getDayNames(
    calendarSetings.language ? calendarSetings.language : "en"
  );
  const alternativeColor = true;
  alternateColor = calendarSetings.alternativeBgColor
    ? calendarSetings.alternativeBgColor
    : "#FFFFFF";
  textColor = calendarSetings.textColor ? calendarSetings.textColor : "#000000";
  headerColor = calendarSetings.headerBgColor
    ? calendarSetings.headerBgColor
    : "#cccccc";
  headerTextColor = calendarSetings.headerTextColor
    ? calendarSetings.headerTextColor
    : "#000000";
  const weekendDayNameTextColor = calendarSetings.weekendTextColor
    ? calendarSetings.weekendTextColor
    : headerTextColor;
  const weekendTextColor = calendarSetings.weekendTextColor
    ? calendarSetings.weekendTextColor
    : textColor;
  fontSize = calendarSetings.fontSize ? calendarSetings.fontSize : 40;
  const fontFamily = calendarSetings.fontFamily
    ? calendarSetings.fontFamily
    : "Arial";
  const fontWeight = calendarSetings.fontWeight
    ? calendarSetings.fontWeight
    : "normal";
  const borderWidth = calendarSetings.borderWidth
    ? calendarSetings.borderWidth
    : 1;
  borderColor = calendarSetings.borderColor
    ? calendarSetings.borderColor
    : "#000000";
  const borderRadius = calendarSetings.borderRadius
    ? calendarSetings.borderRadius
    : 0;
  // Multi-column geometry — row-major order: weeks flow left→right, then wrap to next row
  const totalWeeks = weeks.length;
  const effectiveColumns = Math.min(weeksColumns, totalWeeks || 1);
  const maxRows = Math.ceil(totalWeeks / effectiveColumns);

  // Row-major: col = weekIndex % effectiveColumns, row = floor(weekIndex / effectiveColumns)
  const getWeekPosition = (weekIndex) => ({
    weekColIndex: weekIndex % effectiveColumns,
    rowInCol: Math.floor(weekIndex / effectiveColumns),
  });

  const cellWidth = width / (7 * effectiveColumns);
  const cellHeight = height / (maxRows + 1); // maxRows data rows + 1 header row
  // x-stride between columns: 7 cells + 6 inter-cell gaps
  const colStride = 7 * cellWidth + 6 * cellMargin;

  const svgWidth = effectiveColumns * colStride + borderWidth * 2;
  const svgHeight = (maxRows + 1) * (cellHeight + cellMargin) + fontSize / 2 + borderWidth * 2;

  return (
    <svg
      className={`cal cal${calIndex} cal-grid`}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      width={item.width}
      height={item.height}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Day-name header row — repeated for each column */}
      {Array.from({ length: effectiveColumns }, (_, colIndex) =>
        dayNames.map((day, dayIndex) => {
          const index = dayIndex;
          const x = dayIndex * (cellWidth + cellMargin) + colIndex * colStride;
          const y = cellMargin + fontSize / 2 + borderWidth / 2;

          return (
            <g
              key={`header-${colIndex}-${dayIndex}`}
              className="cal-header"
              transform={`translate(${borderWidth}, ${-cellMargin})`}
            >
              <rect
                className="cal-header"
                x={x}
                y={y}
                width={cellWidth}
                height={cellHeight}
                fill={
                  index === 0 && calendarSetings.weekendBgColor
                    ? calendarSetings.weekendBgColor
                    : headerColor
                }
                stroke={borderColor}
                strokeWidth={borderWidth}
                rx={borderRadius}
                ry={borderRadius}
              />

              <text
                className="cal-header__label"
                x={x + cellWidth / 2}
                y={y + cellHeight / 3 + fontSize / 2}
                alignmentBaseline="middle"
                width={cellWidth}
                textAnchor="middle"
                fontSize={fontSize}
                fontFamily={fontFamily}
                fontWeight={fontWeight}
                fill={index === 0 ? weekendDayNameTextColor : headerTextColor}
              >
                {calendarSetings.dayNameFormat === "tiny" && day.tinyName}
                {calendarSetings.dayNameFormat === "short" && day.shortName}
                {calendarSetings.dayNameFormat === "full" && day.fullName}
                {(calendarSetings.dayNameFormat === undefined ||
                  calendarSetings.dayNameFormat === "") &&
                  day.shortName}
              </text>
            </g>
          );
        })
      )}

      {/* Draw the calendar grid */}
      {weeks.map((week, weekIndex) => {
        const { weekColIndex, rowInCol } = getWeekPosition(weekIndex);
        return week.map((day, dayIndex) => {
          const x = dayIndex * (cellWidth + cellMargin) + weekColIndex * colStride;
          const y =
            (rowInCol + 1) * (cellHeight + cellMargin) +
            fontSize / 2 +
            borderWidth / 2;
          let fillColor =
            (dayIndex + weekIndex) % 2 === 0
              ? calendarSetings.backgroundColor
                ? calendarSetings.backgroundColor
                : "#FFFFFF"
              : alternateColor;
          if (!alternativeColor) {
            fillColor = calendarSetings.backgroundColor
              ? calendarSetings.backgroundColor
              : "#FFFFFF";
          }
          if (dayIndex === 0 && calendarSetings.weekendBgColor) {
            fillColor = calendarSetings.weekendBgColor;
          }

          const cellClass = `cal-cell-${weekIndex}-${dayIndex}`;

          return (
            <g
              key={`${weekIndex}-${dayIndex}`}
              className={cellClass}
              transform={`translate(${borderWidth}, ${borderWidth})`}
            >
              <rect
                className="cal-cell-bg"
                x={x}
                y={y}
                width={cellWidth}
                height={cellHeight}
                fill={fillColor}
                stroke={borderColor}
                strokeWidth={borderWidth}
                rx={borderRadius}
                ry={borderRadius}
              />

              {day && (
                <text
                  className="cal-cell-number"
                  x={x + cellWidth / 2}
                  y={y + cellHeight / 3 + fontSize / 2}
                  alignmentBaseline="middle"
                  textAnchor="middle"
                  fill={dayIndex === 0 ? weekendTextColor : textColor}
                  fontSize={fontSize}
                  fontFamily={fontFamily}
                  fontWeight={fontWeight}
                >
                  {convertNumberToLanguage(
                    day,
                    calendarSetings.language ? calendarSetings.language : "en"
                  )}
                </text>
              )}
            </g>
          );
        });
      })}
    </svg>
  );
};

export default DynamicCalendar;

// Export helper functions for use in other components
export {
  numberMappings,
  monthNameMappings,
  convertNumberToLanguage,
  getMonthName,
  getDayNames,
};
