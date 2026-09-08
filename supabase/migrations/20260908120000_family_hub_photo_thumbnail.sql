-- 앨범 목록/썸네일에서 원본 풀사이즈 이미지를 매번 내려받는 게 egress 소모의
-- 주범이라, 업로드 시 작게 리사이즈한 썸네일을 별도 오브젝트로 같이 저장하고
-- 목록에는 그걸 쓰도록 한다. 원본은 라이트박스에서 확대할 때만 로드.
alter table t_photo add column if not exists thumb_path text;
