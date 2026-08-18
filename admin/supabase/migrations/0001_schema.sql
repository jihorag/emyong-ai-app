-- 지식그래프 스키마.
--
-- 두 축을 담는다. 계층 축은 concepts.parent_id 의 자기참조 트리,
-- 태그 축은 tags ─ concept_tags 의 다대다다.
-- 진단은 태그 축에서 나오므로, 태그는 자유입력이 아니라
-- tags 에 미리 등록된 (axis, value) 쌍만 참조할 수 있게 막는다.

create table concepts (
  id               text primary key,
  parent_id        text references concepts(id) on delete restrict,
  level            text not null,
  name             text not null,
  knowledge_type   text,
  achievement_code text,
  payload          jsonb not null default '{}'::jsonb,
  review_status    text not null default 'draft',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint concepts_level_chk
    check (level in ('subject', 'area', 'grade_band', 'content', 'concept')),
  constraint concepts_knowledge_type_chk
    check (knowledge_type is null or knowledge_type in ('기본이론', '교육과정', '모형', '각론')),
  constraint concepts_review_status_chk
    check (review_status in ('draft', 'reviewed', 'final')),
  -- 자기 자신을 부모로 두는 것만 선언적으로 막는다.
  -- 길이 2 이상의 순환은 3단계 재귀 CTE 검증에서 잡는다.
  constraint concepts_parent_not_self_chk
    check (parent_id is distinct from id)
);

create index concepts_parent_id_idx    on concepts (parent_id);
create index concepts_level_idx        on concepts (level);
create index concepts_review_status_idx on concepts (review_status);

-- 이 테이블이 곧 태그 허용값 목록이다.
-- concept_tags 가 tag_id 로만 참조하므로, 여기 없는 태그는 애초에 붙을 수 없다.
create table tags (
  id        serial primary key,
  axis      text not null,
  value     text not null,
  guideline text,

  constraint tags_axis_chk
    check (axis in ('지식유형', '개념유형', '표현양식', '지도방법', '오개념유형', '출제이력')),
  constraint tags_axis_value_uniq unique (axis, value)
);

create table concept_tags (
  concept_id text not null references concepts(id) on delete cascade,
  tag_id     integer not null references tags(id) on delete restrict,
  confidence text,

  primary key (concept_id, tag_id),
  constraint concept_tags_confidence_chk
    check (confidence is null or confidence in ('high', 'medium', 'low'))
);

create index concept_tags_tag_id_idx on concept_tags (tag_id);
-- 5단계 검수 큐가 low 부터 훑는다.
create index concept_tags_low_confidence_idx
  on concept_tags (concept_id) where confidence = 'low';

create table prerequisites (
  concept_id  text not null references concepts(id) on delete cascade,
  requires_id text not null references concepts(id) on delete cascade,

  primary key (concept_id, requires_id),
  constraint prerequisites_not_self_chk check (concept_id <> requires_id)
);

create index prerequisites_requires_id_idx on prerequisites (requires_id);

create table items (
  id              text primary key,
  cognitive_level text not null,
  item_format     text not null,
  source          text not null,
  exam_year       integer,
  body            text not null,
  review_status   text not null default 'draft',

  constraint items_cognitive_level_chk check (cognitive_level in ('재생', '이해', '적용', '추론')),
  constraint items_item_format_chk     check (item_format in ('기입형', '서술형', '논술형')),
  constraint items_source_chk          check (source in ('기출', '변형', '자체제작')),
  constraint items_review_status_chk   check (review_status in ('draft', 'reviewed', 'final'))
);

create index items_review_status_idx on items (review_status);

create table scoring_elements (
  id         serial primary key,
  item_id    text not null references items(id) on delete cascade,
  concept_id text not null references concepts(id) on delete restrict,
  points     numeric not null,
  keywords   text[] not null default '{}',

  constraint scoring_elements_points_chk check (points > 0)
);

create index scoring_elements_item_id_idx    on scoring_elements (item_id);
create index scoring_elements_concept_id_idx on scoring_elements (concept_id);

-- 문항 단위가 아니라 채점요소 단위로 쌓인다.
-- 추론형 문항 하나가 여러 개념의 기록 여러 건이 될 수 있다.
-- item_id 와 scoring_element_id 는 둘 다 비어 있을 수 있다(개념읽기·기억확인처럼 문항이 없는 모드).
create table attempts (
  id                 bigserial primary key,
  user_id            uuid not null,
  item_id            text references items(id) on delete set null,
  scoring_element_id integer references scoring_elements(id) on delete set null,
  concept_id         text not null references concepts(id) on delete restrict,
  verdict            text not null,
  mode               text not null,
  -- 4단계 시뮬레이터가 만든 가짜 기록. 실제 사용자 집계에서 반드시 제외한다.
  is_simulated       boolean not null default false,
  created_at         timestamptz not null default now(),

  constraint attempts_verdict_chk check (verdict in ('O', '△', 'X')),
  constraint attempts_mode_chk
    check (mode in ('개념읽기', '기억확인', '질문', '개념활용', '스제트', '문제풀기'))
);

create index attempts_concept_id_idx      on attempts (concept_id);
create index attempts_user_concept_idx    on attempts (user_id, concept_id);
create index attempts_real_concept_idx    on attempts (concept_id) where not is_simulated;
create index attempts_simulated_user_idx  on attempts (user_id) where is_simulated;

create table concept_state (
  user_id        uuid not null,
  concept_id     text not null references concepts(id) on delete cascade,
  mastery        numeric not null default 0,
  exposures      integer not null default 0,
  next_review_at timestamptz,

  primary key (user_id, concept_id),
  constraint concept_state_mastery_chk   check (mastery between 0 and 1),
  constraint concept_state_exposures_chk check (exposures >= 0)
);

create index concept_state_due_idx on concept_state (user_id, next_review_at);

create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger concepts_set_updated_at
  before update on concepts
  for each row execute function set_updated_at();

-- 관리자 전용 DB다. 정책을 하나도 두지 않아 anon·authenticated 키로는 아무 행도 읽거나 쓸 수 없고,
-- RLS 를 우회하는 service_role 키를 쓰는 서버 라우트에서만 접근된다.
alter table concepts         enable row level security;
alter table tags             enable row level security;
alter table concept_tags     enable row level security;
alter table prerequisites    enable row level security;
alter table items            enable row level security;
alter table scoring_elements enable row level security;
alter table attempts         enable row level security;
alter table concept_state    enable row level security;
