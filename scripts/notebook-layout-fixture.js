// Synthetic maximum-size library, served only on an isolated QA origin.
// Installed before study-ai hydrates; no requests or account data access.
(() => {
  const params=new URLSearchParams(location.search);
  const count=params.get('books')==='empty'?0:params.get('books')==='one'?1:30;
  const title='중학교 수학의 도형과 분수를 연결해 이해하는 긴 단원 이름';
  const notes=Array.from({length:count},(_,i)=>({id:`layout-note-${i}`,subject:i%2?'과학':'수학',unit:i%3?title:'개념 정리',text:'검수용 필기',summary:'검수용 요약',keywords:['개념','연결','복습'],createdAt:'2026-10-08T00:00:00Z'}));
  const quizzes=Array.from({length:Math.min(count,20)},(_,i)=>({id:`layout-quiz-${i}`,subject:'수학',unit:title,title:`${i+1}. ${title}`,questions:[{question:'검수용 질문',type:'multiple_choice',options:['1','2'],answer:'1',explanation:'검수용 풀이'}],createdAt:'2026-10-08T00:00:00Z'}));
  const resultCount=params.has('recommendations')?Math.max(0,Math.min(5,Number(params.get('recommendations'))||0)):0;
  const bookRecommendations=Array.from({length:resultCount},(_,i)=>({title:`${i+1}. 우주 과학의 상상력과 따뜻한 이야기로 생각을 넓히는 긴 제목의 책`,author:'로컬 검수 예시',category:'과학 · 문학',reason:'우주 여행과 로봇, 서로 다른 관점에 관한 이야기를 읽으며 과학 개념과 일상 속 질문을 연결해볼 수 있습니다. '.repeat(3),learningPoint:'이야기 속 새로운 기술이 인물의 선택에 어떤 영향을 주는지 찾아보고 자신의 생각을 정리해보세요. '.repeat(2)}));
  localStorage.setItem('schemsStudyAI.v2',JSON.stringify({notes,quizzes,tasks:[],sessions:[],attempts:[],diagnostics:[],bookRecommendations,bookSummary:resultCount?'긴 제목과 본문, 읽기 포인트가 있는 실제 결과 레이아웃을 확인하는 로컬 예시입니다.':''}));
})();
