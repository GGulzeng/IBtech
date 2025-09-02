

3) 월 시뮬레이션
   - index.html?month=5 처럼 주소 뒤에 붙이면 해당 월 규칙 적용

4) meta.data 그래프 예시
   - LINE; labels=1시,2시,3시,4시; values=18,20,22,19
   - BAR; labels=국어,수학,과학; values=80,70,90


[운영 메모]
- 수학 과목은 임시 숨김 처리: styles.css 내 subject-card[data-subject="수학"] 규칙을 제거하면 즉시 복구됩니다.
- 그래프/도형 영역은 레이아웃에서 숨김: styles.css 내 .figure-wrap/.figure-box 규칙을 제거하면 복구됩니다.
