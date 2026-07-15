/**
 * Google Photos Picker API Utilities
 * Handles OAuth flow, session management, and media item retrieval
 */

// Google Photos Picker API configuration
export const GOOGLE_PHOTOS_CONFIG = {
    CLIENT_ID: "",
    CLIENT_SECRET: "",
    SCOPES: "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
    PICKER_API_BASE: "https://photospicker.googleapis.com/v1",
};

// Token storage keys
const TOKEN_STORAGE_KEY = "google_photos_access_token";
const TOKEN_EXPIRY_KEY = "google_photos_token_expiry";

/**
 * Store the access token with expiry time
 * @param {string} accessToken - The access token to store
 * @param {number} expiresIn - Token expiry time in seconds (default: 3600 = 1 hour)
 */
export const storeAccessToken = (accessToken, expiresIn = 3600) => {
    try {
        const expiryTime = Date.now() + (expiresIn * 1000);
        localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    } catch (error) {
    }
};

/**
 * Get the stored access token if it's still valid
 * @returns {string|null} The access token or null if expired/not found
 */
export const getStoredAccessToken = () => {
    try {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

        if (!token || !expiry) {
            return null;
        }

        const expiryTime = parseInt(expiry, 10);
        // Add 5 minute buffer to account for processing time
        if (Date.now() > expiryTime - (5 * 60 * 1000)) {
            // Token expired or about to expire, clear it
            clearStoredToken();
            return null;
        }

        return token;
    } catch (error) {
        return null;
    }
};

/**
 * Clear the stored access token
 */
export const clearStoredToken = () => {
    try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
    } catch (error) {
    }
};


/**
 * Generate a cryptographically secure code verifier for PKCE
 */
export const generateCodeVerifier = () => {
    const array = new Uint32Array(56 / 2);
    window.crypto.getRandomValues(array);
    return Array.from(array, (dec) => `0${dec.toString(16)}`.slice(-2)).join("");
};

/**
 * Generate a code challenge from a code verifier using SHA-256
 */
export const generateCodeChallenge = async (verifier) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
};

/**
 * Build the Google OAuth authorization URL
 */
export const buildAuthUrl = (codeChallenge) => {
    const redirectUri = window.location.origin;
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_PHOTOS_CONFIG.CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(GOOGLE_PHOTOS_CONFIG.SCOPES)}&access_type=offline&prompt=consent&code_challenge=${codeChallenge}&code_challenge_method=S256`;
};

/**
 * Exchange authorization code for access token
 */
export const exchangeCodeForToken = async (code, codeVerifier) => {
    const redirectUri = window.location.origin;

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            code,
            client_id: GOOGLE_PHOTOS_CONFIG.CLIENT_ID,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
            code_verifier: codeVerifier,
            client_secret: GOOGLE_PHOTOS_CONFIG.CLIENT_SECRET,
        }),
    });

    const data = await response.json();

    if (data.access_token) {
        return {
            success: true,
            accessToken: data.access_token,
            expiresIn: data.expires_in || 3600 // Default to 1 hour if not provided
        };
    } else {
        return { success: false, error: data.error_description };
    }
};

/**
 * Create a new Picker session
 */
export const createPickerSession = async (accessToken) => {
    const response = await fetch(`${GOOGLE_PHOTOS_CONFIG.PICKER_API_BASE}/sessions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to create picker session");
    }

    return await response.json();
};

/**
 * Get the session status
 */
export const getSessionStatus = async (accessToken, sessionId) => {
    const response = await fetch(
        `${GOOGLE_PHOTOS_CONFIG.PICKER_API_BASE}/sessions/${sessionId}`,
        {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error("Failed to get session status");
    }

    return await response.json();
};

/**
 * Fetch all selected media items from a session
 */
export const fetchSelectedMediaItems = async (accessToken, sessionId) => {
    let allMediaItems = [];
    let pageToken = null;

    do {
        const url = new URL(`${GOOGLE_PHOTOS_CONFIG.PICKER_API_BASE}/mediaItems`);
        url.searchParams.set("sessionId", sessionId);
        url.searchParams.set("pageSize", "100");
        if (pageToken) {
            url.searchParams.set("pageToken", pageToken);
        }

        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error("Failed to fetch media items");
        }

        const data = await response.json();

        if (data.mediaItems && data.mediaItems.length > 0) {
            allMediaItems = [...allMediaItems, ...data.mediaItems];
        }

        pageToken = data.nextPageToken;
    } while (pageToken);

    return allMediaItems;
};

/**
 * Parse polling interval from config (e.g., "5s" -> 5000ms)
 */
export const parsePollingInterval = (pollingConfig) => {
    let pollInterval = 3000; // Default 3 seconds
    if (pollingConfig?.pollInterval) {
        const seconds = parseFloat(pollingConfig.pollInterval.replace('s', ''));
        pollInterval = seconds * 1000;
    }
    return pollInterval;
};

/**
 * Download an image from a URL and return as a File object
 * @param {string} baseUrl - The base URL of the image from Google Photos
 * @param {string} filename - The filename to use for the downloaded file
 * @param {string} mimeType - The MIME type of the image
 * @param {string} accessToken - The OAuth access token for authentication
 */
export const downloadImageAsFile = async (baseUrl, filename, mimeType, accessToken) => {
    // Add size parameters for reasonable resolution
    const downloadUrl = `${baseUrl}=w2048-h2048`;

    const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    return new File([blob], filename, { type: mimeType });
};
