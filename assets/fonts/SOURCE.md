# Prime Edu font source

## Rounded clock numerals (2026-10-08)

- `nunito-variable.ttf` is the unmodified Nunito variable font (weight 200–1000), from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/nunito). Copyright 2014 The Nunito Project Authors. The SIL Open Font License 1.1 is retained in `nunito-OFL.txt` and shipped beside the font.
- 276,932 bytes; SHA256 `BB55A5CA5C2042335B3991AF27C4D0705D0EF41CAC6164AC737FD8F2A1E85207`.
- Used for StandBy clock numerals and colon (`unicode-range: U+0030-0039,U+003A`), weight 1000, with `font-display: swap`. From v41 the home dial uses the app's regular Gothic at 400, and the StandBy countdown uses Gothic at 500 to distinguish it from the clock.
- Apple's San Francisco font binary was not downloaded or embedded. This is an open-licensed rounded numerical treatment, not a claim that the web app ships Apple's native StandBy font.

## Exam table headings (2026-10-08)

- `pretendard-medium.woff2` is the unmodified Pretendard Medium from the official [v1.3.9 package](https://github.com/orioncactus/pretendard/tree/v1.3.9/packages/pretendard/dist/web/static/woff2). Copyright (c) 2021 Kil Hyung-jin, Reserved Font Name Pretendard. The original SIL OFL 1.1 copyright/license is shipped as `pretendard-OFL.txt`.
- 778,432 bytes; SHA256 `D03481330EEBA0659AB5B87F25CEB504A35DE377DD90A0D0ABA2982EB2D05E2C`.
- CSS alias `Prime Grade Header`, used only in the grade input table's `thead`, at weight 500. The font binary was not subsetted or modified. App body, scores, home clock, and all other Korean text retain the supplied Gothic faces. The face loads with `font-display: swap` when the grade headings are used.

## StandBy countdown numerals (2026-10-08, v42)

- `pretendard-std-semibold.woff2` is the unmodified Pretendard Std SemiBold from the official v1.3.9 `packages/pretendard-std/dist/web/static/woff2` package. It is the official Latin face, not a custom subset. The same upstream copyright/SIL OFL 1.1 is retained in `pretendard-OFL.txt`.
- 136,720 bytes; SHA256 `6168BFF58FE531FBA67FA8D286CFE22594F9F9FB0F99C6AAF23D08C9B245FB35`.
- Alias `Prime Timer UI`, weight 600, digits/colon only, font-display swap. Countdown minutes/seconds share a baseline and size. The home remains Gothic400; StandBy clock remains rounded1000. No Apple font binary was added.

## Previously supplied Korean text faces

- User supplied: `Apple_산돌고딕_Neo.zip`, Drive file `1VzVluZwXXTtHdIQEb6Z3W_L6nL1hopeg` (2026-10-06).
- Original faces: AppleSDGothicNeoR, AppleSDGothicNeoSB, AppleSDGothicNeoB.
- Converted losslessly from TTF to WOFF2 with fontTools/Brotli. No glyph outlines edited; full character coverage retained.
- Total deployed font size: 3,609,104 bytes, versus 11,375,580 bytes for the three original TTF files.
- Loaded by `js/home-polish.css` with `font-display: swap`; font files are local to the app, not fetched from Drive by visitors.
- The supplied files report OS/2 fsType=0. The archive contains no separate license document; this technical flag alone is not proof of a free public web distribution license.
- User instructed app embedding and stated permission. Rights to serve the files publicly should still be confirmed with the rights holder before wider commercial distribution. Apple distinguishes OS font usage from permitted embedding in its [software license, section 2.E](https://www.apple.com/legal/sla/docs/macOSSequoia.pdf).
