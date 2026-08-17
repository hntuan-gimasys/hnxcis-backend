# Thiết lập hạ tầng GCP cho HNX-CIS

Hướng dẫn tạo một lần (one-time) toàn bộ hạ tầng cho **2 service Cloud Run độc lập**:

| Service           | Repo               | Nội dung                          |
| ----------------- | ------------------ | --------------------------------- |
| `hnxcis-backend`  | `hnxcis-backend`   | Express API + Cloud SQL + Gemini  |
| `hnxcis-frontend` | `hnxcis-frontend`  | SPA React build tĩnh, nginx       |

Tất cả lệnh dưới đây chạy bằng `gcloud` (đã `gcloud auth login`).

---

## 0. Biến dùng chung

```bash
export PROJECT_ID="dkquoc-sandbox-cob"          # đổi theo project của bạn
export REGION="asia-southeast1"                 # Singapore - gần VN nhất
export AR_REPO="hnxcis"
export SQL_INSTANCE="hnxcis-pg"
export SQL_DB="hnxcis"
export SQL_APP_USER="hnxcis_app"
export GITHUB_ORG="your-github-org"             # user/org GitHub
export BACKEND_REPO="hnxcis-backend"
export FRONTEND_REPO="hnxcis-frontend"

gcloud config set project "$PROJECT_ID"
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
```

## 1. Bật API

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  compute.googleapis.com
```

## 2. Artifact Registry (chứa Docker image của cả 2 service)

```bash
gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="HNX-CIS container images"
```

## 3. Cloud SQL for PostgreSQL

```bash
# Instance (dev/UAT: db-g1-small; production nên dùng Enterprise Plus + HA)
gcloud sql instances create "$SQL_INSTANCE" \
  --database-version=POSTGRES_16 \
  --region="$REGION" \
  --tier=db-g1-small \
  --storage-size=20GB \
  --storage-auto-increase \
  --backup-start-time=17:00 \
  --availability-type=ZONAL \
  --no-assign-ip \
  --network="projects/$PROJECT_ID/global/networks/default"

# Nếu chưa cấu hình Private Service Access, bỏ 2 cờ cuối để dùng public IP:
#   gcloud sql instances create ... --tier=db-g1-small
# Cloud Run vẫn kết nối an toàn qua Unix socket /cloudsql/<connection name>,
# không phụ thuộc IP allowlist.

# Database
gcloud sql databases create "$SQL_DB" --instance="$SQL_INSTANCE"

# Mật khẩu ngẫu nhiên cho user runtime và user admin (dùng cho migration)
export APP_DB_PASSWORD="$(openssl rand -base64 24)"
export ADMIN_DB_PASSWORD="$(openssl rand -base64 24)"

gcloud sql users create "$SQL_APP_USER" \
  --instance="$SQL_INSTANCE" --password="$APP_DB_PASSWORD"

gcloud sql users set-password postgres \
  --instance="$SQL_INSTANCE" --password="$ADMIN_DB_PASSWORD"

export INSTANCE_CONNECTION_NAME="$(gcloud sql instances describe "$SQL_INSTANCE" --format='value(connectionName)')"
echo "CLOUD_SQL_INSTANCE = $INSTANCE_CONNECTION_NAME"
```

## 4. Secret Manager

```bash
printf '%s' "$APP_DB_PASSWORD"   | gcloud secrets create hnxcis-db-password       --data-file=-
printf '%s' "$ADMIN_DB_PASSWORD" | gcloud secrets create hnxcis-db-admin-password --data-file=-
printf '%s' "YOUR_GEMINI_API_KEY" | gcloud secrets create hnxcis-gemini-api-key   --data-file=-
```

## 5. Service account runtime

```bash
# Backend: đọc secret + kết nối Cloud SQL + verify Firebase ID token
gcloud iam service-accounts create hnxcis-backend-sa --display-name="HNX-CIS Backend runtime"
export BACKEND_SA="hnxcis-backend-sa@$PROJECT_ID.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$BACKEND_SA" --role="roles/cloudsql.client"

# Verify Firebase ID token KHÔNG cần IAM (dùng public key của Google).
# Chỉ thêm quyền dưới đây nếu sau này gọi Admin API (getUser, setCustomUserClaims...):
#   gcloud projects add-iam-policy-binding "$PROJECT_ID" \
#     --member="serviceAccount:$BACKEND_SA" --role="roles/firebaseauth.admin"

gcloud secrets add-iam-policy-binding hnxcis-db-password \
  --member="serviceAccount:$BACKEND_SA" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding hnxcis-gemini-api-key \
  --member="serviceAccount:$BACKEND_SA" --role="roles/secretmanager.secretAccessor"

# Frontend: chỉ phục vụ file tĩnh, không cần quyền gì thêm
gcloud iam service-accounts create hnxcis-frontend-sa --display-name="HNX-CIS Frontend runtime"
export FRONTEND_SA="hnxcis-frontend-sa@$PROJECT_ID.iam.gserviceaccount.com"
```

## 6. Service account cho GitHub Actions (deployer)

```bash
gcloud iam service-accounts create hnxcis-deployer --display-name="HNX-CIS GitHub deployer"
export DEPLOYER_SA="hnxcis-deployer@$PROJECT_ID.iam.gserviceaccount.com"

for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/cloudsql.client \
  roles/secretmanager.secretAccessor \
  roles/iam.serviceAccountUser
do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$DEPLOYER_SA" --role="$ROLE"
done
```

`roles/iam.serviceAccountUser` là bắt buộc để deployer được phép gán
`--service-account` (runtime SA) cho Cloud Run.

## 7. Workload Identity Federation (khuyến nghị — không dùng key JSON)

```bash
gcloud iam workload-identity-pools create github \
  --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github \
  --display-name="GitHub OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner == '$GITHUB_ORG'"

export WIF_POOL="projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github"

# Cho phép đúng 2 repo được mạo danh deployer SA
for REPO in "$BACKEND_REPO" "$FRONTEND_REPO"; do
  gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_SA" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/$WIF_POOL/attribute.repository/$GITHUB_ORG/$REPO"
done

echo "GCP_WORKLOAD_IDENTITY_PROVIDER = $WIF_POOL/providers/github-provider"
echo "GCP_DEPLOYER_SA                = $DEPLOYER_SA"
```

> Nếu tổ chức chưa dùng được WIF: tạo key `gcloud iam service-accounts keys create key.json
> --iam-account="$DEPLOYER_SA"` rồi lưu nội dung vào GitHub secret `GCP_SA_KEY`.
> Workflow tự chuyển sang cách này khi `GCP_WORKLOAD_IDENTITY_PROVIDER` trống.

## 8. Khai báo biến trong 2 repo GitHub

```bash
# Repo backend
gh variable set GCP_PROJECT_ID       --repo "$GITHUB_ORG/$BACKEND_REPO" --body "$PROJECT_ID"
gh variable set GCP_REGION           --repo "$GITHUB_ORG/$BACKEND_REPO" --body "$REGION"
gh variable set AR_REPOSITORY        --repo "$GITHUB_ORG/$BACKEND_REPO" --body "$AR_REPO"
gh variable set CLOUD_RUN_SERVICE    --repo "$GITHUB_ORG/$BACKEND_REPO" --body "hnxcis-backend"
gh variable set CLOUD_RUN_RUNTIME_SA --repo "$GITHUB_ORG/$BACKEND_REPO" --body "$BACKEND_SA"
gh variable set CLOUD_SQL_INSTANCE   --repo "$GITHUB_ORG/$BACKEND_REPO" --body "$INSTANCE_CONNECTION_NAME"
gh variable set SQL_DB_NAME          --repo "$GITHUB_ORG/$BACKEND_REPO" --body "$SQL_DB"
gh variable set SQL_USER             --repo "$GITHUB_ORG/$BACKEND_REPO" --body "$SQL_APP_USER"
# Chỉ cần khi Firebase Auth nằm ở project khác project chạy Cloud Run:
gh variable set FIREBASE_PROJECT_ID  --repo "$GITHUB_ORG/$BACKEND_REPO" --body "dkquoc-sandbox-cob"
gh secret   set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "$GITHUB_ORG/$BACKEND_REPO" --body "$WIF_POOL/providers/github-provider"
gh secret   set GCP_DEPLOYER_SA                --repo "$GITHUB_ORG/$BACKEND_REPO" --body "$DEPLOYER_SA"

# Repo frontend
gh variable set GCP_PROJECT_ID       --repo "$GITHUB_ORG/$FRONTEND_REPO" --body "$PROJECT_ID"
gh variable set GCP_REGION           --repo "$GITHUB_ORG/$FRONTEND_REPO" --body "$REGION"
gh variable set AR_REPOSITORY        --repo "$GITHUB_ORG/$FRONTEND_REPO" --body "$AR_REPO"
gh variable set CLOUD_RUN_SERVICE    --repo "$GITHUB_ORG/$FRONTEND_REPO" --body "hnxcis-frontend"
gh variable set CLOUD_RUN_RUNTIME_SA --repo "$GITHUB_ORG/$FRONTEND_REPO" --body "$FRONTEND_SA"
gh secret   set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "$GITHUB_ORG/$FRONTEND_REPO" --body "$WIF_POOL/providers/github-provider"
gh secret   set GCP_DEPLOYER_SA                --repo "$GITHUB_ORG/$FRONTEND_REPO" --body "$DEPLOYER_SA"
```

## 9. Thứ tự deploy lần đầu

1. **Push repo backend** → workflow deploy chạy → lấy URL, ví dụ
   `https://hnxcis-backend-abc123-as.a.run.app`.
2. Đặt biến cho repo frontend rồi **push repo frontend**:
   ```bash
   gh variable set API_BASE_URL --repo "$GITHUB_ORG/$FRONTEND_REPO" \
     --body "https://hnxcis-backend-abc123-as.a.run.app"
   ```
3. Lấy URL frontend, cập nhật CORS cho backend:
   ```bash
   gh variable set CORS_ORIGINS --repo "$GITHUB_ORG/$BACKEND_REPO" \
     --body "https://hnxcis-frontend-xyz789-as.a.run.app"
   ```
   rồi chạy lại workflow deploy backend (hoặc cập nhật nhanh):
   ```bash
   gcloud run services update hnxcis-backend --region "$REGION" \
     --set-env-vars "CORS_ORIGINS=https://hnxcis-frontend-xyz789-as.a.run.app"
   ```
4. Tạo schema database: chạy workflow **Migrate Cloud SQL (Drizzle)** với lệnh
   **`migrate`** — kể cả lần đầu.

   > ⚠️ **Không dùng `push`.** `drizzle-kit push` sinh bảng thẳng từ `schema.ts` và
   > **bỏ qua hoàn toàn** 3 migration thủ công `0001`–`0003`. Kết quả là có đủ 30
   > bảng nhưng **không có** RLS, không có chặn xoá cứng, không có audit
   > append-only, không có versioning — tức mất sạch các ràng buộc NT2/NT3/MT3 mà
   > gói M1/M2 dựng lên, và mất **im lặng**: không lệnh nào báo lỗi.

   Điều kiện tiên quyết: role runtime `hnxcis_app` phải tồn tại **trước khi** chạy
   migration, nếu không `0001` sẽ dừng với `RAISE EXCEPTION`. Mục 3 ở trên đã tạo
   nó bằng `gcloud sql users create "$SQL_APP_USER"`.

5. **Kiểm tra RLS thực sự có hiệu lực** (xem mục 10).

## 10. Kiểm tra

```bash
BACKEND_URL="$(gcloud run services describe hnxcis-backend  --region "$REGION" --format='value(status.url)')"
FRONTEND_URL="$(gcloud run services describe hnxcis-frontend --region "$REGION" --format='value(status.url)')"

curl -s "$BACKEND_URL/api/health"      # {"status":"ok",...}
curl -s "$BACKEND_URL/api/health/db"   # {"status":"ok","database":"hnxcis",...}
curl -s "$FRONTEND_URL/env.js"         # window.__APP_CONFIG__ = { API_BASE_URL: "<backend url>" ... }
```

### 10.1 Kiểm tra schema và RLS (bắt buộc sau lần migrate đầu tiên)

Mở Cloud SQL Auth Proxy rồi vào bằng **user admin**:

```bash
cloud-sql-proxy --port 5432 "$INSTANCE_CONNECTION_NAME" &
psql "host=127.0.0.1 port=5432 dbname=$SQL_DB user=postgres"
```

```sql
-- Phải ra 30 bảng, 30 bảng bật RLS, 14 hàm app_*, 30 trigger chặn xoá cứng.
SELECT count(*) FROM information_schema.tables WHERE table_schema='public';
SELECT count(*) FROM pg_class WHERE relrowsecurity AND relnamespace='public'::regnamespace;
SELECT count(*) FROM pg_proc  WHERE proname LIKE 'app!_%' ESCAPE '!';
SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal;
```

Ba phép thử dưới đây phải **thất bại/lọc đúng**. Bắt buộc `SET ROLE hnxcis_app`
trước: chạy dưới `postgres` sẽ luôn thấy hết vì **superuser bypass RLS bất kể
`FORCE ROW LEVEL SECURITY`** — kiểm tra dưới `postgres` cho kết quả sai lệch.

```sql
SET ROLE hnxcis_app;
SET app.actor_type = 'ORGANIZATION';
SET app.org_id = '1';

SELECT count(*) FROM submissions WHERE organization_id <> 1;  -- phải = 0
DELETE FROM submissions WHERE id = 1;                         -- phải raise exception
UPDATE audit_logs SET reason = 'x' WHERE id = 1;              -- phải raise exception
```

## 11. Ghi chú vận hành

- **Chi phí**: đặt `--min-instances=0` (mặc định) để scale-to-zero. Cloud SQL tính
  tiền theo giờ chạy, dừng instance khi không dùng: `gcloud sql instances patch
  "$SQL_INSTANCE" --activation-policy=NEVER`.
- **Cold start + DB**: pool Postgres được mở lazy, `/api/health` không chạm DB nên
  startup probe không bị chậm vì Cloud SQL.
- **`SQL_USER` phải luôn là `hnxcis_app`, tuyệt đối không phải `postgres`.**
  PostgreSQL cho superuser bypass RLS **bất kể** `FORCE ROW LEVEL SECURITY`, và
  `postgres` trên Cloud SQL là `cloudsqlsuperuser`. Đặt nhầm thành `postgres` thì
  toàn bộ phân quyền dữ liệu (trục 2 của AuthZ Engine) biến mất mà **không có lỗi
  nào được ném ra** — service vẫn chạy, chỉ là mọi doanh nghiệp đọc được dữ liệu
  của nhau. `deploy-cloudrun.yml` mặc định đúng (`vars.SQL_USER || 'hnxcis_app'`);
  chỉ cần đừng ghi đè biến `SQL_USER` ở repo thành `postgres`.
- **Bảo mật**: khi đã có luồng đăng nhập Firebase ở frontend, bật
  `AUTH_REQUIRED=true` cho backend. Muốn chặn hẳn truy cập ẩn danh ở tầng hạ tầng,
  đặt biến `ALLOW_UNAUTHENTICATED=false` — khi đó frontend phải gọi backend kèm
  ID token của Google (service-to-service), không gọi trực tiếp từ trình duyệt được.
- **Domain riêng**: `gcloud beta run domain-mappings create --service hnxcis-frontend
  --domain cis.hnx.vn` (nhớ cập nhật `CORS_ORIGINS`).
