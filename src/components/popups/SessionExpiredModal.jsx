import React, { useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { setAuthItems } from "../../store/slices/projectSetup";
import styled, { keyframes } from "styled-components";
import { FaClock, FaEnvelope, FaMobileAlt, FaEye, FaEyeSlash } from "react-icons/fa";
import CryptoJS from "crypto-js";
import { ENDPOINTS } from "../../library/utils/constants/apiurl";
import { apiPost } from "../../library/utils/common-services/apiCall";
import { LOGIN_CRYPTO_KEY } from "../../library/utils/constants";
import { isDesktop } from "../../desktop/index";
import {
  rememberCredential,
  getRememberedEmails,
  getRememberedPassword,
  removeRememberedEmail,
} from "../../library/utils/helpers/session";
import RememberedEmails from "../auth/RememberedEmails";

const FALLBACK_DOMAIN = "https://editor.magzapp.in";
const getDomain = () => {
  const h = window.location.hostname;
  // Desktop (Electron, app://) and local dev have no real brand domain — use the fallback.
  if (isDesktop || h === "localhost" || h.includes("trycloudflare") || h === "127.0.0.1" || h === "") return FALLBACK_DOMAIN;
  return `${window.location.protocol}//${h}`;
};

const decryptLoginResponse = (encryptedStr) => {
  const decrypted = CryptoJS.AES.decrypt(encryptedStr, LOGIN_CRYPTO_KEY).toString(CryptoJS.enc.Utf8);
  return JSON.parse(decrypted);
};

const reloadWithNewToken = (token) => {
  // Desktop uses HashRouter (app://): the active route + query live in the URL hash. Write u_id
  // into the hash's query (react-router ignores the real query under HashRouter), then reload so
  // the app re-initializes (useInitializeProject re-runs with the fresh token).
  if (isDesktop) {
    const rawHash = window.location.hash.replace(/^#/, "") || "/";
    const [path, query = ""] = rawHash.split("?");
    const params = new URLSearchParams(query);
    params.set("u_id", token);
    window.location.hash = `#${path}?${params.toString()}`;
    window.location.reload();
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("u_id", token);
  window.location.href = url.toString();
};

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  padding: 20px;
  animation: ${fadeIn} 0.3s ease-out;
`;

const Container = styled.div`
  width: 100%;
  max-width: 440px;
  background: #ffffff;
  border-radius: 16px;
  padding: 36px 32px;
  border: 1px solid #e6e6e6;
  animation: ${slideUp} 0.4s cubic-bezier(0.16, 1, 0.3, 1);

  @media (max-width: 480px) {
    padding: 28px 20px;
  }
`;

const IconWrapper = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #f2f2f2;
  color: #111111;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin: 0 auto 20px;
`;

const Title = styled.h2`
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: #111111;
  text-align: center;
`;

const Subtitle = styled.p`
  margin: 0 0 24px;
  font-size: 14px;
  color: #6b6b6b;
  text-align: center;
  line-height: 1.5;
`;

const TabRow = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
`;

const TabButton = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border: 1.5px solid ${(p) => (p.$active ? "#111111" : "#e6e6e6")};
  background: ${(p) => (p.$active ? "#f0f0f0" : "#fff")};
  color: ${(p) => (p.$active ? "#111111" : "#6b6b6b")};
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #111111;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 14px;
`;

const Label = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #333333;
  margin-bottom: 6px;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1.5px solid #e6e6e6;
  border-radius: 8px;
  font-size: 14px;
  color: #111111;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;

  &:focus {
    border-color: #111111;
  }

  &::placeholder {
    color: #9a9a9a;
  }
`;

/* Wraps the password Input so the show/hide toggle can sit at its right edge. */
const PasswordWrap = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9a9a9a;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;

  &:hover {
    color: #111111;
    background: #f2f2f2;
  }
  &:focus-visible {
    outline: none;
    color: #111111;
    box-shadow: 0 0 0 2px rgba(17, 17, 17, 0.22);
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 11px 16px;
  background: #111111;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 6px;

  &:hover:not(:disabled) {
    background: #000000;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ErrorText = styled.p`
  margin: 0 0 12px;
  font-size: 13px;
  color: #111111;
  text-align: center;
`;

const SessionExpiredModal = () => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("email"); // "email" | "phone"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rememberedEmails, setRememberedEmails] = useState(() => getRememberedEmails());
  const passwordRef = useRef(null);

  const handlePickEmail = (picked) => {
    setEmail(picked);
    setError("");
    getRememberedPassword(picked)
      .then((pw) => {
        if (pw) {
          // One-click re-login: fill the password AND submit immediately with the
          // picked account's credentials (no wait for the state to flush). If no
          // password was saved, fall back to focusing the field to type.
          setPassword(pw);
          performLogin(picked, pw);
        } else {
          requestAnimationFrame(() => passwordRef.current?.focus());
        }
      })
      .catch(() => requestAnimationFrame(() => passwordRef.current?.focus()));
  };

  const handleForgetEmail = (picked) => {
    setRememberedEmails(removeRememberedEmail(picked));
  };

  // Core login routine — shared by the manual form submit and the one-click
  // account-picker auto-login. Takes explicit credentials so the picker can sign
  // in immediately without waiting for the email/password state to flush.
  const performLogin = async (loginEmail, loginPassword) => {
    if (!loginEmail || !loginPassword) { setError("Please enter email and password."); return; }
    setLoading(true);
    setError("");
    try {
      const data = await apiPost(ENDPOINTS.authLogin, { email: loginEmail, password: loginPassword, domain: getDomain() }, { skipBrandId: true });
      if (data?.status === 1 && data?.items) {
        const user = typeof data.items === "string" ? decryptLoginResponse(data.items) : data.items;
        // Remember this account (email + password) for the login account picker.
        rememberCredential(loginEmail, loginPassword);
        dispatch(setAuthItems(user));
        reloadWithNewToken(user.accessToken);
      } else {
        setError(data?.message || "Login failed. Please try again.");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = (e) => {
    e.preventDefault();
    performLogin(email, password);
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!phone) { setError("Please enter your phone number."); return; }
    setLoading(true);
    setError("");
    try {
      const data = await apiPost(ENDPOINTS.authLogin, { phone, domain: getDomain() }, { skipBrandId: true });
      if (data?.status === 1) {
        dispatch(setAuthItems(data.items));
        setOtpSent(true);
        setError("");
      } else {
        setError(data?.message || "Failed to send OTP. Please try again.");
      }
    } catch (err) {
      setError("Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp) { setError("Please enter the OTP."); return; }
    setLoading(true);
    setError("");
    try {
      const data = await apiPost(ENDPOINTS.verifyOTP, { phone, otp: Number(otp), domain: getDomain() }, { skipBrandId: true });
      if (data?.status === 1 && data?.items) {
        const user = typeof data.items === "string" ? decryptLoginResponse(data.items) : data.items;
        dispatch(setAuthItems(user));
        reloadWithNewToken(user.accessToken);
      } else {
        setError(data?.message || "OTP verification failed. Please try again.");
      }
    } catch (err) {
      setError("OTP verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Overlay>
      <Container>
        <IconWrapper>
          <FaClock />
        </IconWrapper>
        <Title>Session Expired</Title>
        <Subtitle>
          Your session has expired. Please log in again to continue.
        </Subtitle>

        {/* <TabRow>
          <TabButton
            $active={activeTab === "email"}
            onClick={() => { setActiveTab("email"); setError(""); setOtpSent(false); setOtp(""); }}
          >
            <FaEnvelope size={14} /> Email Login
          </TabButton>
          <TabButton
            $active={activeTab === "phone"}
            onClick={() => { setActiveTab("phone"); setError(""); setOtpSent(false); setOtp(""); }}
          >
            <FaMobileAlt size={14} /> Phone Login
          </TabButton>
        </TabRow> */}

        {error && <ErrorText>{error}</ErrorText>}

        <RememberedEmails
          emails={rememberedEmails}
          activeEmail={email}
          onPick={handlePickEmail}
          onRemove={handleForgetEmail}
        />

        {/* {activeTab === "email" ? ( */}
        <form onSubmit={handleEmailLogin}>
          <FormGroup>
            <Label>Email</Label>
            <Input type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)} autoFocus />
          </FormGroup>
          <FormGroup>
            <Label>Password</Label>
            <PasswordWrap>
              <Input ref={passwordRef} type={showPassword ? "text" : "password"} placeholder="Password" value={password}
                onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 42 }} />
              <PasswordToggle type="button" onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}
                title={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </PasswordToggle>
            </PasswordWrap>
          </FormGroup>
          <SubmitButton type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </SubmitButton>
        </form>
        {/* ) : !otpSent ? (
          <form onSubmit={handleSendOTP}>
            <FormGroup>
              <Label>Phone Number</Label>
              <Input type="tel" placeholder="Enter your phone number" value={phone}
                onChange={(e) => setPhone(e.target.value)} autoFocus />
            </FormGroup>
            <SubmitButton type="submit" disabled={loading}>
              {loading ? "Sending OTP..." : "Send OTP"}
            </SubmitButton>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <FormGroup>
              <Label>OTP sent to {phone}</Label>
              <Input type="number" placeholder="Enter OTP" value={otp}
                onChange={(e) => setOtp(e.target.value)} autoFocus />
            </FormGroup>
            <SubmitButton type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify OTP"}
            </SubmitButton>
            <SubmitButton type="button" disabled={loading}
              style={{ marginTop: 8, background: "transparent", color: "var(--primary)", border: "1.5px solid var(--primary)" }}
              onClick={() => { setOtpSent(false); setOtp(""); setError(""); }}>
              Change Number
            </SubmitButton>
          </form>
        )} */}
      </Container>
    </Overlay>
  );
};

export default SessionExpiredModal;
