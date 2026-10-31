// Phone ki apni (free, offline) awaaz se bolna. Hindi voice mile toh woh, warna Indian English.
let voice = null

function pickVoice() {
  const all = window.speechSynthesis?.getVoices() || []
  voice = all.find((v) => v.lang === 'hi-IN') || all.find((v) => v.lang === 'en-IN') || all.find((v) => v.lang.startsWith('en')) || null
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  pickVoice()
  window.speechSynthesis.onvoiceschanged = pickVoice
}

export function speak(text) {
  const synth = window.speechSynthesis
  if (!synth || !text) return
  // Emoji aur brackets bolne layak nahi hote, hata do
  const clean = text.replace(/[\p{Extended_Pictographic}️]/gu, '').replace(/\(.*?\)/g, '').trim()
  synth.cancel() // purani baat beech mein kaat ke nayi bolo (hints purane ho jaate hain)
  const u = new SpeechSynthesisUtterance(clean)
  if (voice) { u.voice = voice; u.lang = voice.lang }
  u.rate = 1.05
  synth.speak(u)
}
