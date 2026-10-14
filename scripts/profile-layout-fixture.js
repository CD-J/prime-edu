// Isolated, synthetic layout fixture. This page must never save a profile.
document.addEventListener('DOMContentLoaded',()=>{
  const launch=document.createElement('button');launch.type='button';launch.textContent='회원정보 레이아웃 검수';launch.style.cssText='position:fixed;top:90px;right:16px;z-index:10000;padding:12px;background:#fff;color:#111;border-radius:14px';document.body.append(launch);
  document.getElementById('profileForm').addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
  launch.onclick=()=>{
    const $=id=>document.getElementById(id);
    $('profileEmailHint').textContent='layout-qa@example.invalid';$('profileDisplayName').value='[예시] 학생';$('profileSchoolLevel').value='middle';$('profileGrade').value='3';$('profileClassNo').value='1';$('profileSchoolQuery').value='[예시] 아주 긴 이름의 중학교';$('profileSelectedSchool').textContent='[예시] 아주 긴 이름의 중학교 · 학교 주소와 검색 선택 영역 검수';
    const modal=$('profileModal');modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');window.dispatchEvent(new Event('prime:controls-sync'));launch.hidden=true;
  };
});
