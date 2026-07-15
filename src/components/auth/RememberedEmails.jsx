import React from "react";
import styled from "styled-components";
import { FaRegUserCircle, FaTimes } from "react-icons/fa";

// Account picker shown on the login screens (LoginPage + SessionExpiredModal).
// Lists the email addresses previously used to sign in ON THIS DEVICE so the user
// can pick one and just type the password. It renders ONLY the email string —
// passwords are never stored or shown. Data comes from session.js
// (getRememberedEmails / removeRememberedEmail); this component is purely
// presentational and matches the minimalist login styling.

const Wrap = styled.div`
  margin: 0 0 16px;
`;

const Heading = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: #6b6b6b;
  margin-bottom: 8px;
`;

const List = styled.div`
  border: 1.5px solid #e6e6e6;
  border-radius: 8px;
  overflow: hidden;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s;
  background: ${(p) => (p.$active ? "#f2f2f2" : "#fff")};

  & + & {
    border-top: 1px solid #f0f0f0;
  }

  &:hover {
    background: #f7f7f7;
  }
`;

const EmailIcon = styled.span`
  color: #9a9a9a;
  display: flex;
  align-items: center;
  font-size: 16px;
`;

const EmailText = styled.span`
  flex: 1;
  font-size: 14px;
  color: #111111;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RemoveButton = styled.button`
  border: none;
  background: transparent;
  color: #b0b0b0;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: #111111;
    background: #ececec;
  }
`;

/**
 * @param {string[]} emails - previously-used emails, most-recent first.
 * @param {string}   activeEmail - the currently-typed email (row highlight).
 * @param {(email: string) => void} onPick - fill the email field with this one.
 * @param {(email: string) => void} onRemove - forget this email.
 */
const RememberedEmails = ({ emails, activeEmail, onPick, onRemove }) => {
  if (!emails || emails.length === 0) return null;

  return (
    <Wrap>
      <Heading>Sign in as</Heading>
      <List>
        {emails.map((email) => (
          <Row
            key={email}
            $active={activeEmail && activeEmail.toLowerCase() === email.toLowerCase()}
            onClick={() => onPick(email)}
            title={`Sign in as ${email}`}
          >
            <EmailIcon>
              <FaRegUserCircle />
            </EmailIcon>
            <EmailText>{email}</EmailText>
            {onRemove && (
              <RemoveButton
                type="button"
                aria-label={`Forget ${email}`}
                title="Forget this email"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(email);
                }}
              >
                <FaTimes size={12} />
              </RemoveButton>
            )}
          </Row>
        ))}
      </List>
    </Wrap>
  );
};

export default RememberedEmails;
