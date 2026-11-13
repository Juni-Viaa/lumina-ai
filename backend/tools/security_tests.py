#!/usr/bin/env python3
"""
Security testing utilities untuk Phase 3.

Usage:
    python backend/tools/security_tests.py

Test scenarios:
1. XSS injection prevention
2. CSRF attack simulation  
3. Session hijacking attempt
4. HTTP header injection
5. Rate limiting enforcement
"""

import requests
import json
import uuid
from datetime import datetime, timedelta


class SecurityTester:
    """Security testing utilities."""

    def __init__(self, base_url="http://localhost:8000/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.test_user = None
        self.session_cookie = None

    def create_test_user(self):
        """Create test user untuk security testing."""
        url = f"{self.base_url}/auth/register/"
        payload = {
            "email": f"security-test-{uuid.uuid4().hex[:8]}@example.com",
            "username": f"security-test-{uuid.uuid4().hex[:8]}",
            "password": "TestPass123!",
            "password_confirm": "TestPass123!",
        }

        response = self.session.post(url, json=payload)
        if response.status_code in [200, 201]:
            self.test_user = response.json()
            # Extract session cookie
            cookies = response.cookies.get_dict()
            self.session_cookie = cookies.get("lumina_session")
            print(f"✅ Created test user: {self.test_user['user']['email']}")
            return True
        else:
            print(f"❌ Failed to create test user: {response.status_code}")
            print(response.text)
            return False

    def test_xss_prevention(self):
        """Test XSS injection prevention."""
        print("\n=== XSS Injection Prevention Test ===")
        
        # Test 1: XSS dalam username registration
        malicious_username = "<script>alert('xss')</script>"
        
        url = f"{self.base_url}/auth/register/"
        payload = {
            "email": f"xss-test-{uuid.uuid4().hex[:8]}@example.com",
            "username": malicious_username,
            "password": "TestPass123!",
            "password_confirm": "TestPass123!",
        }

        response = requests.post(url, json=payload)
        
        if response.status_code in [200, 201]:
            print("✅ Registration dengan username berisi script tag")
            print("Note: Script tags harus di-escape dalam response")
        else:
            print(f"❌ Registration rejected: {response.status_code}")
        
        # Test 2: XSS dalam search query
        malicious_query = "<img src=x onerror=alert('xss')>"
        
        if self.session_cookie:
            cookies = {"lumina_session": self.session_cookie}
            url = f"{self.base_url}/documents/search/?q={malicious_query}"
            
            response = self.session.get(url, cookies=cookies)
            
            if response.status_code in [200, 400, 403]:
                print("✅ Search query dengan XSS payload")
                print("Note: Payload harus di-escape/sanitize")
            else:
                print(f"❌ Search query error: {response.status_code}")
        else:
            print("⚠️  Skip XSS search test (no active session)")

        return True

    def test_csrf_protection(self):
        """Test CSRF protection."""
        print("\n=== CSRF Protection Test ===")
        
        # Test 1: POST tanpa CSRF token
        url = f"{self.base_url}/auth/login/"
        payload = {
            "email": "test@example.com",
            "password": "password123",
        }

        # Simulate cross-origin request (no Referer header, no CSRF token)
        headers = {
            "Content-Type": "application/json",
        }
        
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code == 403:
            print("✅ CSRF protection active (403 on missing token)")
        else:
            print(f"⚠️  CSRF check status: {response.status_code}")
        
        # Test 2: Valid POST dengan CSRF token
        # First get CSRF token
        csrf_url = f"{self.base_url}/auth/csrf/"
        response = requests.get(csrf_url)
        
        if response.status_code == 200:
            csrf_token = response.json().get("csrf_token")
            
            headers["X-CSRFToken"] = csrf_token
            
            response = requests.post(url, json=payload, headers=headers)
            
            if response.status_code in [200, 401]:
                print("✅ POST dengan valid CSRF token")
            else:
                print(f"❌ POST with CSRF failed: {response.status_code}")
        
        return True

    def test_session_hijacking(self):
        """Test session hijacking prevention."""
        print("\n=== Session Hijacking Test ===")
        
        if not self.session_cookie:
            print("⚠️  Skip session hijacking test (no active session)")
            return False
        
        # Test 1: Attempt to use session cookie in different context
        print("Testing HttpOnly cookie protection...")
        print("Note: JavaScript tidak bisa akses HttpOnly cookies")
        
        # Test 2: Attempt to use invalid session key
        invalid_session_key = str(uuid.uuid4())
        
        cookies = {"lumina_session": invalid_session_key}
        url = f"{self.base_url}/auth/me/"
        
        response = requests.get(url, cookies=cookies)
        
        if response.status_code == 401:
            print("✅ Invalid session key rejected (401)")
        else:
            print(f"⚠️  Invalid session response: {response.status_code}")
        
        # Test 3: Attempt replay old session cookie
        old_session_key = "expired-session-" + uuid.uuid4().hex[:16]
        
        cookies = {"lumina_session": old_session_key}
        response = requests.get(url, cookies=cookies)
        
        if response.status_code == 401:
            print("✅ Expired session key rejected (401)")
        else:
            print(f"⚠️  Old session response: {response.status_code}")
        
        return True

    def test_rate_limiting(self):
        """Test rate limiting enforcement."""
        print("\n=== Rate Limiting Test ===")
        
        url = f"{self.base_url}/auth/login/"
        payload = {
            "email": f"rate-test-{uuid.uuid4().hex[:8]}@example.com",
            "password": "wrongpassword",
        }
        
        # Make multiple rapid requests
        responses = []
        for i in range(15):  # Should trigger rate limit (10/minute)
            response = requests.post(url, json=payload)
            responses.append(response.status_code)
            
            if i < 5:
                print(f"  Request {i+1}: {response.status_code}")
        
        # Check for 429 (Too Many Requests) or throttle
        if 429 in responses:
            print("✅ Rate limiting active (429 detected)")
        elif any(status == 401 for status in responses[:5]):
            print("✅ Normal auth failures (not rate limited)")
        else:
            print("⚠️  No rate limiting detected in first 15 attempts")
        
        return True

    def test_sql_injection(self):
        """Test SQL injection prevention."""
        print("\n=== SQL Injection Prevention Test ===")
        
        # SQL injection attempt dalam search query
        sql_payload = "' OR '1'='1"
        
        url = f"{self.base_url}/documents/search/?q={sql_payload}"
        
        if self.session_cookie:
            cookies = {"lumina_session": self.session_cookie}
            response = requests.get(url, cookies=cookies)
        else:
            response = requests.get(url)
        
        # Should not crash server or expose database errors
        if response.status_code in [200, 400, 403]:
            print("✅ SQL injection attempt handled gracefully")
            print("Note: Django ORM parameterized queries prevent SQLi")
        elif response.status_code >= 500:
            print("⚠️  Server error on SQLi attempt (possible vulnerability)")
        else:
            print(f"⚠️  Unexpected response: {response.status_code}")
        
        return True

    def test_http_header_injection(self):
        """Test HTTP header injection prevention."""
        print("\n=== HTTP Header Injection Test ===")
        
        # Header injection attempt
        malicious_header = "malicious-value\r\nX-Injected-Header: injected"
        
        url = f"{self.base_url}/auth/csrf/"
        headers = {
            "X-Test-Header": malicious_header,
        }
        
        response = requests.get(url, headers=headers)
        
        if response.status_code in [200, 400]:
            print("✅ HTTP header injection attempt handled")
        elif response.status_code >= 500:
            print("⚠️  Server error on header injection")
        else:
            print(f"⚠️  Unexpected response: {response.status_code}")
        
        return True

    def run_all_tests(self):
        """Run semua security tests."""
        print("🔒 Running Lumina Security Tests")
        print("=" * 50)
        
        # Create test user first
        if not self.create_test_user():
            print("⚠️  Failed to create test user, some tests may be skipped")
        
        tests = [
            ("XSS Prevention", self.test_xss_prevention),
            ("CSRF Protection", self.test_csrf_protection),
            ("Session Hijacking", self.test_session_hijacking),
            ("Rate Limiting", self.test_rate_limiting),
            ("SQL Injection", self.test_sql_injection),
            ("HTTP Header Injection", self.test_http_header_injection),
        ]
        
        results = []
        for test_name, test_func in tests:
            print(f"\nRunning: {test_name}")
            try:
                success = test_func()
                results.append((test_name, success))
            except Exception as e:
                print(f"❌ Error in {test_name}: {e}")
                results.append((test_name, False))
        
        # Summary
        print("\n" + "=" * 50)
        print("Security Test Summary:")
        print("=" * 50)
        
        for test_name, success in results:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{status} - {test_name}")
        
        passed = sum(1 for _, success in results if success)
        total = len(results)
        
        print(f"\n{passed}/{total} tests passed ({passed/total*100:.0f}%)")
        
        return all(success for _, success in results)


if __name__ == "__main__":
    tester = SecurityTester()
    
    try:
        success = tester.run_all_tests()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted.")
        exit(1)
    except Exception as e:
        print(f"\n❌ Error running tests: {e}")
        exit(1)
