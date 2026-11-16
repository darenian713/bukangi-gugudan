// 실시간 대결은 Firebase(인터넷)를 쓰기 때문에 파일(file://)로 직접 열면 동작하지 않습니다.
// 그럴 때 하얀 화면 대신 안내를 보여 줍니다. (일반 script — 모듈이 막혀도 실행됨)
(function () {
  if (location.protocol !== 'file:') return;
  document.addEventListener('DOMContentLoaded', function () {
    var box = document.createElement('div');
    box.className = 'file-guard';
    box.setAttribute('role', 'alert');
    box.innerHTML = '<h2>실시간 대결은 인터넷 주소에서 열어 주세요</h2>' +
      '<p>혼자 하기는 index.html 파일만 열어도 되지만, 실시간 대결은 여러 기기가 서로 연결돼야 해서 ' +
      'GitHub Pages 같은 웹 주소(https://…)로 열어야 해요. README의 “실시간 대결 준비하기”를 보세요.</p>' +
      '<p><a href="../index.html">← 혼자 하기로 돌아가기</a></p>';
    document.body.appendChild(box);
  });
})();
