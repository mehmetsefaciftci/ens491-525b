# Ethics application: working draft

Team 525B · ENS491-492 · Supervisor: Selim Balcısoy · Draft of 11 Nov 2026

This draft collects what an ethics application normally asks for. **Before submitting, check the university's current application form, required attachments and meeting calendar with the ethics committee office; copy this text into their form.** Fields we cannot fill yet are marked TODO.

## 1. Study summary

We test whether an augmented-reality museum guide that adapts the format of its content (brief or detailed, text or audio) to the visitor's behaviour and surroundings lowers mental demand without lowering recall, compared with a format the visitor chooses themselves. Participants look at printed reproductions of public-domain paintings with a smartphone in a university room, listen to or read short descriptions, and answer questionnaires.

## 2. Participants

- About 24 university students (18+) for the main study and 4–6 for a pilot; recruited by announcement. TODO: recruitment channel and text.
- Exclusion: under 18; uncorrected visual or hearing impairment that prevents both text and audio (the system offers both, so most impairments do not exclude).
- Compensation: TODO (none / course credit / small gift; check rules).

## 3. Procedure (about 40 minutes)

1. Information sheet and written consent.
2. Short prior-knowledge quiz and 1–7 familiarity rating.
3. Practice artwork: the participant tries all four formats and picks one.
4. Four blocks (adaptive or fixed × quiet or recorded museum noise played at a comfortable level), two artworks each, order counterbalanced.
5. After each block: Raw NASA-TLX mental demand, Paas effort; after each system: SUS.
6. End of session: core-fact recall test.
7. Debriefing.

## 4. Data collected

| Data | Purpose | Identifiable? |
|---|---|---|
| Questionnaire answers, recall scores | outcomes | pseudonymous (participant code) |
| Interaction log: formats shown, skips, replays, overrides, timestamps | outcomes, policy evaluation | pseudonymous |
| Sound level as one number per second | context input | no |
| Accelerometer magnitude | context input | no |
| Camera frames | artwork tracking only, processed on the phone | **not stored** |
| Raw audio | none: the microphone gives a level number only | **not stored** |
| Name and signature | consent form only | stored on paper, separate from data |

No face, eye or physiological data are collected (the optional face/eye model is out of scope).

## 5. Risks and mitigations

- Minimal risk. Noise blocks use recorded museum sound at a comfortable level, below 70 dB(A) at the listening position (TODO: verify with a sound level meter); participants may lower the volume or stop at any time.
- Fatigue: breaks between blocks; the session can be stopped without giving a reason.
- No deception.

## 6. Data protection (KVKK)

- Pseudonymous codes; the key linking codes to names is kept separately by one team member and destroyed after the study.
- Data stored on university-managed storage; TODO: retention period (e.g. until the end of ENS492 plus the period required for publication).
- Participants can withdraw and ask for their data to be deleted until the data are anonymised (TODO: date).
- Only aggregated results are published.

## 7. Information sheet and consent form (English)

> **Context-aware AR museum guide: study information**
> You are invited to a study by Sabancı University students Mehmet Sefa Çiftci and Bahar Küçüközer, supervised by Selim Balcısoy. You will use a phone to look at printed reproductions of paintings and read or listen to short descriptions, then answer short questionnaires and a few questions about the paintings. It takes about 40 minutes.
> The phone camera is used only to recognise the paintings; no images are stored. The microphone measures only how loud the room is; no sound is recorded. We store your answers and a log of how you used the guide under a code, not your name.
> Taking part is voluntary. You can stop at any time without giving a reason, and you can ask us to delete your data until [date]. Some blocks play recorded museum noise at a comfortable level; tell us if it is uncomfortable.
> Contact: [team email] · Supervisor: [supervisor email] · Ethics committee: [office contact]
> ☐ I have read this information and agree to take part. Name, date, signature.

## 8. Bilgilendirme ve onam formu (Türkçe)

> **Bağlama duyarlı AR müze rehberi: çalışma bilgisi**
> Sabancı Üniversitesi öğrencileri Mehmet Sefa Çiftci ve Bahar Küçüközer'in, Selim Balcısoy danışmanlığında yürüttüğü bir çalışmaya davet ediliyorsunuz. Bir telefonla tabloların basılı kopyalarına bakacak, kısa açıklamaları okuyacak ya da dinleyeceksiniz; ardından kısa anketleri ve tablolarla ilgili birkaç soruyu yanıtlayacaksınız. Çalışma yaklaşık 40 dakika sürer.
> Telefon kamerası yalnızca tabloları tanımak için kullanılır; görüntü kaydedilmez. Mikrofon yalnızca ortamın ses seviyesini ölçer; ses kaydı yapılmaz. Yanıtlarınız ve rehberi nasıl kullandığınıza dair kayıt, adınızla değil bir kodla saklanır.
> Katılım gönüllüdür. İstediğiniz an gerekçe göstermeden bırakabilir, [tarih] tarihine kadar verilerinizin silinmesini isteyebilirsiniz. Bazı bölümlerde rahatsız etmeyecek düzeyde kayıtlı müze sesi çalınır; rahatsız olursanız bize söyleyin.
> İletişim: [ekip e-postası] · Danışman: [danışman e-postası] · Etik kurul: [ofis iletişim]
> ☐ Bu bilgileri okudum ve çalışmaya katılmayı kabul ediyorum. Ad soyad, tarih, imza.

## 9. Attachments to prepare

- Questionnaires: Raw NASA-TLX (mental demand item), Paas scale, SUS, recall test (draft items in `content/artworks.json`).
- Recruitment text.
- Supervisor approval / signature page. TODO.
