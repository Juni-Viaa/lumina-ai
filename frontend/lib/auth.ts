/**
 * Auth/session helpers — user session management via HttpOnly cookie.
 * Sumber kebenaran: backend Django (CookieSessionAuthentication).
 * 
 * Cookie tidak bisa dibaca JavaScript (HttpOnly), jadi auth state harus
 * dicek via backend endpoint /auth/me/.
 * 
 * localStorage digunakan hanya untuk menyimpan user profile (bukan token).
 */

import { useState, useEffect } from "react";

export interface AuthUser {
    id: number;
    email: string;
    username: string;
    role: "mahasiswa" | "admin";
    is_staff: boolean;
    created_at: string;
    session_expires_at?: string;
}

export interface AuthState {
    user: AuthUser | null;
    sessionExpires: string | null;
    isLoading: boolean;
}

const USER_KEY = "lumina_user";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

function safeStorage(): Storage | null {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function getUserFromStorage(): AuthUser | null {
    const raw = safeStorage()?.getItem(USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as AuthUser;
    } catch {
        return null;
    }
}

function setUserInStorage(user: AuthUser): void {
    safeStorage()?.setItem(USER_KEY, JSON.stringify(user));
}

function clearUserFromStorage(): void {
    safeStorage()?.removeItem(USER_KEY);
}

export async function checkSession(): Promise<AuthUser | null> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/auth/me/`,
            {
                credentials: "include",
            }
        );
        
        if (response.status === 200) {
            const user = await response.json() as AuthUser;
            setUserInStorage(user);
            return user;
        }
        
        return null;
    } catch {
        return null;
    }
}

export async function getCsrfToken(): Promise<string | null> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/auth/csrf/`,
            {
                credentials: "include",
            }
        );
        
        if (response.status === 200) {
            const data = await response.json();
            return data.csrf_token ?? null;
        }
        return null;
    } catch {
        return null;
    }
}

export async function logout(): Promise<void> {
    try {
        await fetch(
            `${API_BASE_URL}/auth/logout/`,
            {
                method: "POST",
                credentials: "include",
            }
        );
    } catch {
    }
    clearUserFromStorage();
}

export function getUser(): AuthUser | null {
    return getUserFromStorage();
}

export function setUser(user: AuthUser): void {
    setUserInStorage(user);
}

export function clearAuth(): void {
    clearUserFromStorage();
}

export function useAuth(): AuthState {
    const [state, setState] = useState<AuthState>({
        user: getUserFromStorage(),
        sessionExpires: null,
        isLoading: true,
    });

    useEffect(() => {
        checkSession()
            .then((user) => {
                if (user) {
                    setState({
                        user,
                        sessionExpires: user.session_expires_at ?? null,
                        isLoading: false,
                    });
                } else {
                    setState({
                        user: null,
                        sessionExpires: null,
                        isLoading: false,
                    });
                }
            })
            .catch(() => {
                setState({
                    user: getUserFromStorage(),
                    sessionExpires: null,
                    isLoading: false,
                });
            });
    }, []);

    return state;
}
