// Synthetic review records, loaded only by the isolated review preview server.
(() => {
  const params = new URLSearchParams(location.search);
  document.title = 'Prime Edu · 로컬 검수 예시';
  const key = 'schemsStudyAI.v2:guest';
  if (params.has('resetreview')) localStorage.removeItem(key);
  if (localStorage.getItem(key) && !params.has('emptyreview')) return;
  const date = window.SchemsReviewCore.dateKey(new Date());
  const quizzes = params.has('emptyreview') ? [] : [{id:'review-demo-math',subject:'수학',unit:'일차함수',title:'일차함수와 그래프',createdAt:`${date}T01:00:00Z`,questions:[
    {question:'일차함수 y = 2x + 3의 그래프에서 기울기는 얼마인가요?',options:['2','3','5','−2'],answer:'2',explanation:'x가 1 증가할 때 y는 2 증가해요. x의 계수인 2가 기울기예요.'},
    {question:'일차함수 y = −x + 4에서 y절편은 얼마인가요?',options:['−1','1','4','−4'],answer:'4',explanation:'y절편은 x = 0일 때의 y값이에요. 이 식에서는 4예요.'}]},
    {id:'review-demo-science',subject:'과학',unit:'물질의 구성',title:'원자와 분자의 관계를 연결해 이해하는 개념 확인 문제',createdAt:`${date}T02:00:00Z`,questions:[
      {question:'물질의 성질을 유지하는 가장 작은 입자로, 원자들이 결합해 만들어지는 것은 무엇인가요?',answer:'분자',explanation:'분자는 원자들이 결합한 입자예요. 예를 들어 물 분자는 수소 원자 2개와 산소 원자 1개로 이루어져요.'}]}];
  const attempts = quizzes.map(q => ({id:`${q.id}-attempt`,quizId:q.id,date,createdAt:`${date}T03:00:00Z`,total:q.questions.length,score:0,accuracy:0,answers:q.questions.map(()=>'-'),details:q.questions.map(question=>({question:question.question,correct:false,correctAnswer:question.answer,answer:'-',explanation:question.explanation}))}));
  localStorage.setItem(key,JSON.stringify({quizzes,attempts,notes:[],tasks:[],sessions:[],diagnostics:[]}));
})();
