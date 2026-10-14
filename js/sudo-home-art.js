/* A single painted scene behind the home copy; no texture request or render loop. */
(function () {
  'use strict';
  document.querySelectorAll('[data-sudo-home-logo]').forEach((host, index) => {
    const id = `sudo-portrait-${index}`;
    const mobile = !!host.closest('.mobile-home-landing');
    host.classList.add('sudo-glass-portrait');
    host.innerHTML = `<svg viewBox="${mobile ? '540 0 740 800' : '0 0 1400 700'}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="${id}-surface" cx=".36" cy=".05" r=".82">
          <stop offset="0" class="sudo-glass-white"/><stop offset=".34" class="sudo-glass-body"/>
          <stop offset=".72" class="sudo-glass-tone"/><stop offset="1" class="sudo-glass-deep"/>
        </radialGradient>
        <linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2=".9">
          <stop offset="0" class="sudo-glass-rim" stop-opacity="0"/><stop offset=".45" class="sudo-glass-rim"/>
          <stop offset="1" class="sudo-glass-white" stop-opacity=".12"/>
        </linearGradient>
        <linearGradient id="${id}-shine" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="white" stop-opacity=".8"/><stop offset="1" stop-color="white" stop-opacity="0"/>
        </linearGradient>
        <radialGradient id="${id}-prism" cx=".65" cy=".2" r=".68">
          <stop class="sudo-glass-prism" stop-opacity=".65"/><stop offset="1" class="sudo-glass-tone" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${id}-facet" x1="0" y1="0" x2=".7" y2="1">
          <stop offset="0" class="sudo-glass-white" stop-opacity=".72"/><stop offset=".38" class="sudo-glass-prism" stop-opacity=".22"/><stop offset="1" class="sudo-glass-deep" stop-opacity=".05"/>
        </linearGradient>
        <radialGradient id="${id}-glint" cx=".5" cy=".5" r=".5">
          <stop offset="0" stop-color="white" stop-opacity=".9"/><stop offset=".23" stop-color="white" stop-opacity=".28"/><stop offset="1" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${id}-dispersion" x1="0" y1="0" x2="1" y2=".6">
          <stop offset="0" class="sudo-glass-prism" stop-opacity="0"/><stop offset=".42" stop-color="white" stop-opacity=".55"/><stop offset=".68" class="sudo-glass-prism" stop-opacity=".42"/><stop offset="1" class="sudo-glass-tone" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="${id}-fade" x1="0" y1="0" x2="${mobile ? '0' : '1'}" y2="1">
          <stop offset="0" stop-color="white"/><stop offset="${mobile ? '.36' : '.4'}" stop-color="white" stop-opacity=".82"/>
          <stop offset="1" stop-color="white" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="${id}-reading-space" x1="0" y1="0" x2="${mobile ? '0' : '1'}" y2="${mobile ? '1' : '0'}">
          <stop offset="0" class="sudo-glass-white" stop-opacity="${mobile ? '0' : '.98'}"/>
          <stop offset="${mobile ? '.25' : '.3'}" class="sudo-glass-white" stop-opacity="${mobile ? '.06' : '.93'}"/>
          <stop offset="${mobile ? '.59' : '.65'}" class="sudo-glass-white" stop-opacity="${mobile ? '.95' : '.12'}"/>
          <stop offset="1" class="sudo-glass-white" stop-opacity="${mobile ? '1' : '0'}"/>
        </linearGradient>
        <mask id="${id}-atmosphere"><rect width="1500" height="1000" fill="url(#${id}-fade)"/></mask>
        <clipPath id="${id}-clip"><ellipse cx="1070" cy="735" rx="825" ry="660" transform="rotate(-16 1070 735)"/></clipPath>
      </defs>
      <g mask="url(#${id}-atmosphere)">
        <g clip-path="url(#${id}-clip)">
          <ellipse cx="1070" cy="735" rx="825" ry="660" transform="rotate(-16 1070 735)" fill="url(#${id}-surface)"/>
          <ellipse cx="1070" cy="735" rx="825" ry="660" transform="rotate(-16 1070 735)" fill="url(#${id}-prism)"/>
          <path d="M410 284 712 102 1150 88 1440 230 1250 540 780 460Z" fill="url(#${id}-shine)" opacity=".6"/>
          <path d="m410 284 370 176 370-372M712 102l68 358 470 80M1150 88l290 142-190 310" fill="none" stroke="white" stroke-opacity=".23" stroke-width="1.2"/>
          <g fill="url(#${id}-facet)">
            <path d="m520 236 192-134 68 358Z" opacity=".46"/>
            <path d="m712 102 178-38 260 24-226 210Z" opacity=".32"/>
            <path d="m924 298 226-210 150 38-50 414Z" opacity=".24"/>
            <path d="m780 460 144-162 326 242-266 126Z" opacity=".18"/>
            <path d="m1250 540 190-310 120 108-20 270Z" opacity=".34"/>
          </g>
          <g fill="none" stroke="white" stroke-linecap="round">
            <path d="M469 247C719 48 1090 42 1330 166" stroke-width=".8" stroke-opacity=".72"/>
            <path d="M477 255C703 75 1088 72 1327 177" stroke-width="2.5" stroke-opacity=".18"/>
            <path d="M612 330 924 298 1250 540M890 64l34 234 60 368" stroke-width=".9" stroke-opacity=".2"/>
            <path d="M526 338C724 159 1037 133 1288 217" stroke-width="16" stroke-opacity=".025"/>
          </g>
          <ellipse cx="810" cy="145" rx="200" ry="24" transform="rotate(-12 810 145)" fill="url(#${id}-glint)" opacity=".8"/>
          <ellipse cx="1260" cy="333" rx="62" ry="130" transform="rotate(28 1260 333)" fill="url(#${id}-glint)" opacity=".17"/>
          <ellipse cx="1078" cy="750" rx="811" ry="646" transform="rotate(-16 1078 750)" fill="none" stroke="url(#${id}-rim)" stroke-width="8" opacity=".52"/>
          <path d="M435 262C650 62 1050 38 1352 174" fill="none" stroke="white" stroke-opacity=".8" stroke-width="3"/>
          <path d="M449 267C668 78 1039 57 1345 186" fill="none" stroke="url(#${id}-dispersion)" stroke-width="14" opacity=".24"/>
          <path d="M552 303C716 184 930 143 1138 188" fill="none" stroke="url(#${id}-dispersion)" stroke-width="2" opacity=".28"/>
          <path d="m712 102 16 270 52 88M1150 88l-14 138 114 314" fill="none" stroke="url(#${id}-dispersion)" stroke-width="1.4" opacity=".33"/>
          <g transform="translate(1064 225) rotate(-17) skewX(7)" class="sudo-glass-eyes">
            <rect x="-35" y="-39" width="22" height="74" rx="11" fill="currentColor" opacity=".12"/>
            <rect x="11" y="-39" width="22" height="74" rx="11" fill="currentColor" opacity=".12"/>
            <rect x="-37" y="-42" width="22" height="74" rx="11" fill="currentColor"/>
            <rect x="9" y="-42" width="22" height="74" rx="11" fill="currentColor"/>
            <path d="M-30-34v40M16-34v40" stroke="white" stroke-opacity=".32" stroke-width="2" stroke-linecap="round"/>
          </g>
        </g>
        <ellipse cx="1070" cy="735" rx="825" ry="660" transform="rotate(-16 1070 735)" fill="none" stroke="url(#${id}-rim)" stroke-width="1.5"/>
      </g>
      <rect x="0" y="0" width="1500" height="1000" fill="url(#${id}-reading-space)"/>
    </svg>`;
  });
})();
