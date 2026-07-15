# Customer Login Flow - Design Document

## Overview
This document outlines the customer login flow for the photo editor, extending the existing admin session-expired modal to support customer authentication via email/phone with domain context.

---

## Current Admin Flow (SessionExpiredModal.jsx)

### Architecture
1. **Session Expiration Trigger**: User's session expires → Modal appears
2. **Domain Context**: Already available in URL (`u_id` parameter contains user token)
3. **Auth Methods**: 
   - Email + Password login
   - Phone + OTP (phone login feature)
4. **Response Handling**: 
   - Encrypted response via AES decryption
   - Extract `accessToken` from user object
   - Reload page with new token in URL param

### Current Endpoints
```
POST /auth/login/           → Email login for admin
POST /auth/store/generateOTP → OTP generation for phone
```

### Current Payload (Admin Email Login)
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

### Current Response (Admin)
```json
{
  "status": 1,
  "items": "U2FsdGVkX1..." // AES encrypted user object
}
```

**Decrypted items object:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user123",
  "email": "admin@example.com",
  "userType": "admin"
}
```

---

## Proposed Customer Login Flow

### 1. Initial Page Load (With Domain Context)

**Scenario**: Customer lands on editor from storefront with brand/store context

```
User URL: https://editor.printpoz.com/?brand_id=br123&store_id=st123

→ SessionExpiredModal appears (or new CustomerLoginModal)
→ Modal captures: domain context (brand_id, store_id)
→ User selects: Email or Phone tab
```

### 2. Login Entry Points

#### 2.1 Email Login (Customer)
```
User enters: email + password + has domain context
```

**Payload:**
```json
{
  "email": "customer@example.com",
  "password": "password123",
  "brand_id": "br123",
  "store_id": "st123"
}
```

**New Endpoint:** `POST /auth/customer/login`

**Response:**
```json
{
  "status": 1,
  "items": "U2FsdGVkX1..." // AES encrypted customer user object
}
```

**Decrypted items object:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "cust123",
  "email": "customer@example.com",
  "userType": "customer",
  "brand_id": "br123",
  "store_id": "st123"
}
```

#### 2.2 Phone OTP Login (Customer - Future)
```
User enters: phone number + has domain context
```

**Step 1 - Generate OTP:**

**Payload:**
```json
{
  "phone": "+1234567890",
  "brand_id": "br123",
  "store_id": "st123"
}
```

**New Endpoint:** `POST /auth/customer/generateOTP`

**Response:**
```json
{
  "status": 1,
  "otpSessionId": "otp_session_abc123",
  "message": "OTP sent to phone"
}
```

**Step 2 - Verify OTP:**

**Payload:**
```json
{
  "otpSessionId": "otp_session_abc123",
  "otp": "123456",
  "phone": "+1234567890",
  "brand_id": "br123",
  "store_id": "st123"
}
```

**New Endpoint:** `POST /auth/customer/verifyOTP`

**Response:** (same as email login)
```json
{
  "status": 1,
  "items": "U2FsdGVkX1..." // AES encrypted customer user object
}
```

---

## Data Model & Token Handling

### Token Structure
Both admin and customer tokens follow same format but include user type:

```
Header: {
  "alg": "HS256",
  "typ": "JWT"
}

Payload: {
  "userId": "user123" | "cust123",
  "email": "user@example.com",
  "userType": "admin" | "customer",
  "brand_id": "br123",
  "store_id": "st123",
  "iat": 1234567890,
  "exp": 1234657890
}

Signature: HMAC-SHA256(header + payload, secret)
```

### Session Management
```
Login successful
  ↓
Extract accessToken from decrypted response
  ↓
Store in URL param: ?u_id=<accessToken>
  ↓
Page reload with token → Frontend validates via apiCall.js
  ↓
Header auto-injects: Authorization: Bearer <token>
```

---

## Updated Login Modal Component

### Component Architecture
Instead of single `SessionExpiredModal`, create:
- `SessionExpiredModal.jsx` → Admin login (email + phone OTP)
- `CustomerLoginModal.jsx` → Customer login (email + phone OTP)

**OR** unify into single modal with `userType` prop:
- `UnifiedLoginModal.jsx` with conditional rendering

### Key Changes

#### 1. Domain Context Injection
```jsx
const getInitialDomain = () => {
  const url = new URL(window.location.href);
  return {
    brand_id: url.searchParams.get("brand_id") || "",
    store_id: url.searchParams.get("store_id") || ""
  };
};
```

#### 2. Email Login Handler (Customer)
```jsx
const handleCustomerEmailLogin = async (e) => {
  e.preventDefault();
  if (!email || !password) {
    setError("Please enter email and password.");
    return;
  }
  
  setLoading(true);
  setError("");
  
  try {
    const domain = getInitialDomain();
    const response = await axios.post(
      ENDPOINTS.customerLogin,  // NEW ENDPOINT
      {
        email,
        password,
        brand_id: domain.brand_id,
        store_id: domain.store_id
      }
    );
    
    const data = response.data;
    if (data?.status === 1 && data?.items) {
      const user = typeof data.items === "string"
        ? decryptLoginResponse(data.items)
        : data.items;
      
      // Verify response includes user type
      if (user?.userType === "customer") {
        reloadWithNewToken(user.accessToken);
      } else {
        setError("Invalid user type for customer login");
      }
    } else {
      setError(data?.message || "Login failed. Please try again.");
    }
  } catch (err) {
    setError(err?.response?.data?.message || "Login failed. Please try again.");
  } finally {
    setLoading(false);
  }
};
```

#### 3. Phone OTP Handler (Customer - Future)
```jsx
const [otpSessionId, setOtpSessionId] = useState("");
const [otpSent, setOtpSent] = useState(false);
const [otp, setOtp] = useState("");

const handleCustomerPhoneLogin = async (e) => {
  e.preventDefault();
  if (!phone) {
    setError("Please enter your phone number.");
    return;
  }
  
  setLoading(true);
  setError("");
  
  try {
    const domain = getInitialDomain();
    const response = await axios.post(
      ENDPOINTS.customerGenerateOTP,  // NEW ENDPOINT
      {
        phone,
        brand_id: domain.brand_id,
        store_id: domain.store_id
      }
    );
    
    const data = response.data;
    if (data?.status === 1 && data?.otpSessionId) {
      setOtpSessionId(data.otpSessionId);
      setOtpSent(true);
      setError("");
    } else {
      setError(data?.message || "Failed to send OTP");
    }
  } catch (err) {
    setError(err?.response?.data?.message || "Failed to send OTP");
  } finally {
    setLoading(false);
  }
};

const handleVerifyOTP = async (e) => {
  e.preventDefault();
  if (!otp) {
    setError("Please enter OTP");
    return;
  }
  
  setLoading(true);
  setError("");
  
  try {
    const domain = getInitialDomain();
    const response = await axios.post(
      ENDPOINTS.customerVerifyOTP,  // NEW ENDPOINT
      {
        otpSessionId,
        otp,
        phone,
        brand_id: domain.brand_id,
        store_id: domain.store_id
      }
    );
    
    const data = response.data;
    if (data?.status === 1 && data?.items) {
      const user = typeof data.items === "string"
        ? decryptLoginResponse(data.items)
        : data.items;
      
      if (user?.userType === "customer") {
        reloadWithNewToken(user.accessToken);
      } else {
        setError("Invalid user type");
      }
    } else {
      setError(data?.message || "OTP verification failed");
    }
  } catch (err) {
    setError(err?.response?.data?.message || "OTP verification failed");
  } finally {
    setLoading(false);
  }
};
```

---

## Backend API Changes Required

### New Endpoints to Create

#### 1. Customer Email Login
```
POST /auth/customer/login
Purpose: Authenticate customer with email + password + domain context

Request Headers:
- Content-Type: application/json

Request Body:
{
  "email": "customer@example.com",
  "password": "password123",
  "brand_id": "br123",
  "store_id": "st123"
}

Response Success (200):
{
  "status": 1,
  "items": "U2FsdGVkX1..." // AES encrypted
}

Response Failure (401/400):
{
  "status": 0,
  "message": "Invalid email or password"
}
```

#### 2. Customer Generate OTP
```
POST /auth/customer/generateOTP
Purpose: Send OTP to customer phone + validate domain

Request Headers:
- Content-Type: application/json

Request Body:
{
  "phone": "+1234567890",
  "brand_id": "br123",
  "store_id": "st123"
}

Response Success (200):
{
  "status": 1,
  "otpSessionId": "otp_session_abc123",
  "message": "OTP sent to phone",
  "expiresIn": 300 // seconds
}

Response Failure (400/404):
{
  "status": 0,
  "message": "Phone number not found or invalid"
}
```

#### 3. Customer Verify OTP
```
POST /auth/customer/verifyOTP
Purpose: Verify OTP and return authentication token

Request Headers:
- Content-Type: application/json

Request Body:
{
  "otpSessionId": "otp_session_abc123",
  "otp": "123456",
  "phone": "+1234567890",
  "brand_id": "br123",
  "store_id": "st123"
}

Response Success (200):
{
  "status": 1,
  "items": "U2FsdGVkX1..." // AES encrypted
}

Response Failure (401/400):
{
  "status": 0,
  "message": "Invalid or expired OTP"
}
```

### Backend Implementation Considerations

#### 1. Validation
```
For all endpoints:
- Validate email format (RFC 5322)
- Validate phone format (E.164 international)
- Validate brand_id & store_id exist
- Rate limit: 3 failed attempts → 15min cooldown
- OTP expiry: 5 minutes (300 seconds)
```

#### 2. OTP Generation
```
- Generate 6-digit numeric code
- Store otpSessionId (UUID) in session/cache
- Store: otpSessionId, phone, otp hash (bcrypt), timestamp, expiresAt
- Delete from cache after verification or expiry
```

#### 3. Encryption
```
- Use same LOGIN_CRYPTO_KEY from constants
- Payload after login: {
    "accessToken": "...",
    "userId": "...",
    "email": "...",
    "phone": "...",
    "userType": "customer",
    "brand_id": "...",
    "store_id": "..."
  }
- AES.encrypt(JSON.stringify(payload), LOGIN_CRYPTO_KEY)
```

#### 4. Token Generation
```
JWT payload must include:
- userId (customer ID from database)
- email
- phone (optional)
- userType: "customer"
- brand_id
- store_id
- iat (issued at)
- exp (expiry: current + 24 hours)
```

#### 5. Database Schema Changes
```sql
-- Customer users table (if not exists)
CREATE TABLE IF NOT EXISTS customer_users (
  id VARCHAR(36) PRIMARY KEY,
  brand_id VARCHAR(36) NOT NULL,
  store_id VARCHAR(36) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (store_id) REFERENCES stores(id),
  INDEX idx_brand_store (brand_id, store_id),
  INDEX idx_email (email)
);

-- OTP sessions table
CREATE TABLE IF NOT EXISTS otp_sessions (
  id VARCHAR(36) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  brand_id VARCHAR(36) NOT NULL,
  store_id VARCHAR(36) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  INDEX idx_expires_at (expires_at)
);
```

---

## Integration Checklist

### Frontend
- [ ] Add new endpoints to `ENDPOINTS` object in `apiurl.js`:
  - `customerLogin`
  - `customerGenerateOTP`
  - `customerVerifyOTP`
- [ ] Create `CustomerLoginModal.jsx` or extend `SessionExpiredModal.jsx`
- [ ] Implement domain context extraction from URL params
- [ ] Add customer email login handler
- [ ] Add customer phone OTP handlers (2 steps)
- [ ] Add decryption logic (reuse existing `decryptLoginResponse`)
- [ ] Add token reload logic (reuse existing `reloadWithNewToken`)
- [ ] Update error handling and loading states
- [ ] Test with mock backend

### Backend
- [ ] Create `/auth/customer/login` endpoint
- [ ] Create `/auth/customer/generateOTP` endpoint
- [ ] Create `/auth/customer/verifyOTP` endpoint
- [ ] Implement customer user table
- [ ] Implement OTP sessions table
- [ ] Implement rate limiting
- [ ] Implement OTP generation & validation logic
- [ ] Implement JWT token generation (with customer fields)
- [ ] Implement AES encryption for response
- [ ] Add request validation & error handling
- [ ] Add database cleanup (expired OTP sessions)
- [ ] Test endpoints with Postman/API client

### Shared
- [ ] Add `LOGIN_CRYPTO_KEY` to both frontend & backend constants
- [ ] Ensure same encryption algorithm & key
- [ ] Document token payload structure for both admin & customer
- [ ] Set up logging for auth failures (security audit trail)

---

## Login Flow Diagrams

### Admin Session Expired Flow
```
User's session expires
         ↓
Session Expired Modal appears
         ↓
User selects: Email Login or Phone OTP
         ↓
Email: email + password → POST /auth/login/
Phone: phone → POST /auth/store/generateOTP
         ↓
Validate credentials / Send OTP
         ↓
Return encrypted response with accessToken
         ↓
Decrypt & extract accessToken
         ↓
Reload: ?u_id=<accessToken>
         ↓
apiCall.js injects: Authorization: Bearer <accessToken>
         ↓
Session restored ✓
```

### Customer Login Flow (New)
```
Customer lands on editor: /?brand_id=br123&store_id=st123
         ↓
Check if authenticated (token in URL/localStorage)
         ↓
If not: Customer Login Modal appears
         ↓
User selects: Email Login or Phone OTP
         ↓
Email: email + password + domain → POST /auth/customer/login
Phone: phone + domain → POST /auth/customer/generateOTP
         ↓
[Phone Path]
OTP sent → User enters OTP
         ↓
Verify OTP: otpSessionId + otp + domain → POST /auth/customer/verifyOTP
         ↓
Validate & return encrypted response with accessToken
         ↓
Decrypt & extract accessToken
         ↓
Reload: ?u_id=<accessToken> (domain params preserved)
         ↓
apiCall.js injects: Authorization: Bearer <accessToken>
         ↓
User authenticated as customer ✓
```

---

## Security Considerations

### 1. Token Storage
- **Don't**: Store token in localStorage (XSS vulnerability)
- **Do**: Store in URL params → session state → HTTP-only cookies (backend)

### 2. Rate Limiting
```
Login attempts: 5 attempts per minute per IP
OTP generation: 3 per day per phone number
OTP verification: 5 attempts per otpSessionId
```

### 3. OTP Security
- Generate cryptographically secure 6-digit codes
- Hash OTP in database (bcrypt)
- Auto-delete after 5 minutes
- Limit to 5 verification attempts
- Return generic error messages ("Invalid OTP" — don't reveal if phone exists)

### 4. Encryption
- Use AES-256-CBC (not just AES)
- Unique IV per encryption (not hardcoded)
- Ensure LOGIN_CRYPTO_KEY is environment variable, not hardcoded

### 5. HTTPS Only
- All auth endpoints require HTTPS
- Set Secure flag on cookies
- Set HttpOnly flag on auth cookies

### 6. CORS
- Whitelist editor domain in backend CORS config
- Don't allow all origins for auth endpoints

---

## Testing Scenarios

### Email Login
```
✓ Valid email + password → Success
✗ Invalid email → 401 Invalid credentials
✗ Invalid password → 401 Invalid credentials
✗ Unregistered email → 404 User not found
✗ Missing brand_id/store_id → 400 Invalid domain
✗ Inactive account → 403 Account suspended
```

### Phone OTP
```
✓ Valid phone + domain → OTP sent
✗ Unregistered phone → 404 Phone not found
✗ Invalid phone format → 400 Invalid phone number
✗ Missing domain → 400 Invalid domain
✓ OTP verification (correct) → Success
✗ OTP verification (wrong code) → 401 Invalid OTP
✗ OTP verification (expired) → 401 OTP expired
✗ OTP verification (5+ attempts) → 429 Too many attempts
```

---

## Future Enhancements

1. **Social Login**: Google/Facebook OAuth for customers
2. **Two-Factor Auth**: SMS/Email OTP after password login
3. **Account Recovery**: Forgot password flow
4. **Session Persistence**: Remember device for 30 days
5. **Multi-Session**: Logout other devices
6. **Audit Logging**: Track all login attempts & IP addresses
7. **Biometric Auth**: Face ID / Fingerprint on mobile

---

## References

- Current admin flow: `src/components/popups/SessionExpiredModal.jsx`
- API constants: `src/library/utils/constants/apiurl.js`
- HTTP client: `src/library/utils/common-services/apiCall.js`
- Auth constants: `src/library/utils/constants/index.js` (check for `LOGIN_CRYPTO_KEY`)
- Redux auth setup: Check if needed for customer session state
