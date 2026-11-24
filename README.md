# Kwentuhan: working prototype

A working version of the BU111 live case recommendation: a weekly family question in the Coca-Cola app, unlocked by a glass Coke 2-pack. Lola answers by voice and the answer is kept in the family's tapestry.

Open it on a phone. On a laptop it shows in a phone frame with a QR code.

## What works
- **Family setup**, or load a sample family (the Rosas, 5 weeks in).
- **Weekly question.** A new one every Monday from a 12-week season, in Tagalog and English.
- **Unlock by receipt.** Reads a receipt photo on the phone (Tesseract OCR). Checks for a glass Coke 2-pack, a date in the last 7 days, and that the receipt hasn't been used before. A sample receipt is built in.
- **Free monthly question**, no purchase needed. **Find a 2-pack** opens maps for the big chains.
- **Consent** from the storyteller before the first recording.
- **Recording** with the real microphone. Live transcript where the browser supports it (Tagalog or English).
- **Transcript and translation.** Edit the transcript, translate it (MyMemory, only when you tap), and pick the quote.
- **Photo** from the camera or library, and **artist frames** (banig, parol, capiz, inabel).
- **Tapestry:** 12 squares a season, with playback, a card image and a tapestry image to share.
- **Clip export.** A vertical video with subtitles and Lola's voice, recorded on the phone and shared with the share sheet (TikTok, Reels, Messages).
- **Lola's link.** Send the question to her phone. She records there, no app needed, and sends the file back; you import it.
- **Settings:** Monday calendar reminder (.ics), install to home screen (PWA), delete the archive (typed confirmation), and prototype controls to skip weeks.

Everything is stored on the device (IndexedDB). No server or accounts.

## Deploy
A static site with no build step. On Vercel: Import → Framework preset **Other** → Deploy.

## Credits
Archivo font (SIL OFL), Tesseract.js (Apache 2.0), qrcode-generator (MIT).

Student prototype for a university case competition. Not affiliated with, or endorsed by, The Coca-Cola Company.
