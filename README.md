# Project CLARA

### Product link
[Project CLARA](https://clara-app-phi.vercel.app/)

### Dify yml files
[CLARA Scribe](https://github.com/nguyenntdev/clara-app/blob/main/Medical%20Scribe%20(GDG%20Devfest)%20(6).yml)

[CLARA Research](https://github.com/nguyenntdev/clara-app/blob/main/Project%20CLARA.yml)

### CLARA Medical Scribe
<img width="1653" height="242" alt="{891C19BB-8525-4DA2-B37F-845EDCEAA747}" src="https://github.com/user-attachments/assets/6ea1a11c-cb0c-4860-82b5-288f8be2069d" />
<img width="1845" height="511" alt="{ABCA3A10-6222-44E4-85DE-F644C9353F06}" src="https://github.com/user-attachments/assets/c39bbcb4-0a83-4c55-82e6-66079755a38b" />
<img width="1192" height="207" alt="{779E6118-9E46-4941-8C3A-4889FCF91703}" src="https://github.com/user-attachments/assets/66821fad-d0f5-40d6-88c8-0e2810b15aa9" />

#### Cách hoạt động:
- Nhận input (text hoặc audio) → phân loại medical / non-medical.
- Nếu không phải y khoa → trả câu trả lời mặc định.
- Nếu là y khoa → (nếu có audio thì chuyển thành text) → chuẩn hoá, ẩn danh, cấu trúc lâm sàng, trích thuật ngữ.
- Dùng thuật ngữ → tra cứu nhiều nguồn kiến thức y khoa → gom lại bằng template.
- Kết hợp mã hoá + evidence, định dạng lại, LLM rà soát.
- Xuất ra ANSWER_FINAL gửi lại cho người dùng.


### CLARA Research
<img width="1745" height="635" alt="{4E40B517-DB2F-4811-BD4B-E6EEE1B5834B}" src="https://github.com/user-attachments/assets/b13c5128-c5ce-4f4b-8c82-338b83134719" />

#### Cách hoạt động:
- START → R_DECIDER: phân loại câu hỏi.
- Nếu chỉ là câu hỏi bình thường → NORMAL CHAT → ANSWER 3 (Trả lời câu hỏi).
- Nếu cần tra cứu nghiêm túc:

SINGLE EXTRACTOR & RQ1: phân tích và rút từ khoá / RQ.

Nhiều BUILD QUERY + KNOWLEDGE RETRIEVAL song song cho từng nguồn (UMLS, ICD, thuốc, ClinicalTrials, OpenFDA, Google, nguồn VN…).

COMBINED EVIDENCE: gộp lại các nguồn Knowledge Retrieval.

LLM → ANSWER: đọc evidence, tổng hợp, trả lời cuối.
