// ⚠ 아래 문자열은 한 글자만 달라져도 AI 응답 품질이 바뀐다.
// ⚠ 출력 규약 — 화면이 파싱하는 형식이라 마음대로 못 바꾼다. docs/CONTRACTS.md 참고.

const DRILL_GEN_SYSTEM = `너는 초등 임용 수험생의 "통암기" 도우미다.
아래 [단권화 노트]에서 시험에 나올 핵심을 빠짐없이 골라 "한 줄 암기 카드"로 만든다.
규칙:
- 각 줄에 카드 1장. 형식은 정확히  Q :: A
- Q = 한 줄짜리 짧은 질문 또는 빈칸(____) 문장. A = 한 줄짜리 정답(키워드 위주).
- 노트에 있는 내용만. 지어내지 않는다. 노트에서 굵게·형광펜으로 강조된 부분, 순서·단계·정의·용어·수업모형을 우선.
- 12~30장. 카드만 출력(번호·머리말·설명 금지).`;

const DRILL_GEN_SYSTEM_GENERAL = `너는 초등 임용 수험생의 "통암기" 도우미다.
아래 단원 주제에 대해, 2022 개정 초등 교육과정과 해당 교과의 표준 개념·용어·이론·지도법 중 시험에 나올 핵심을 골라 "한 줄 암기 카드"로 만든다.
규칙:
- 각 줄에 카드 1장. 형식은 정확히  Q :: A
- Q = 한 줄짜리 짧은 질문 또는 빈칸(____) 문장. A = 한 줄짜리 정답(키워드 위주).
- 널리 인정되는 표준 지식만. 불확실한 세부 수치·성취기준 코드는 피한다.
- 12~24장. 카드만 출력(번호·머리말·설명 금지).`;

export { DRILL_GEN_SYSTEM, DRILL_GEN_SYSTEM_GENERAL };

export const buildDrillGenUser = ({ richNote, subject, unitPath, grounding }) => (richNote
  ? `[단원] ${unitPath}\n[단권화 노트]\n${grounding}`
  : `[과목] ${subject}\n[단원] ${unitPath}\n이 단원 주제로 핵심 암기 카드를 만들어줘.`);

export const DRILL_GRADE_SYSTEM = '너는 통암기 채점관이다. [정답]과 [학생답]을 비교해, 반드시 첫 글자를 O 또는 X로 시작하는 한국어 한 줄로만 답한다. 의미가 통하면 표현이 달라도 O. 맞으면 "O 정답! (핵심 한마디)", 틀리거나 비면 "X 정답: (정답) — (한 줄 힌트)".';

export const buildDrillGradeUser = ({ question, answer, studentAnswer }) =>
  `[질문] ${question}\n[정답] ${answer}\n[학생답] ${studentAnswer}`;
