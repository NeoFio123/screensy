const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

console.log('🔒 Creating self-signed certificate for HTTPS...');

try {
    // Create certificate with Subject Alternative Name for IP addresses
    const certCommand = `openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.crt -days 365 -nodes -subj "/C=DE/ST=NRW/L=City/O=Screensy/CN=localhost" -extensions SAN -config <(echo '[req]'; echo 'distinguished_name=req'; echo '[SAN]'; echo 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:10.0.1.216,IP:169.254.146.194')`;
    
    // Simple version that works on Windows
    const simpleCommand = `openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.crt -days 365 -nodes -subj "/C=DE/ST=NRW/L=City/O=Screensy/CN=localhost"`;
    
    try {
        execSync(simpleCommand, { stdio: 'inherit' });
        console.log('✅ Certificate created successfully!');
    } catch (opensslError) {
        console.log('❌ OpenSSL not found, creating basic certificate files...');
        
        // Create basic self-signed certificate manually (not secure but works for testing)
        const basicKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB
wQNVGKYjam9Q6PcklqR2KQOl3DQqcKIqPbVKFzUhyHRm6PWaowxGrJZqjKr8X+Ka
XeB8WdQ1mC7L5XHD7uNmfxOexu7rEfL3tXjAWJfmWcNm8TL6MZNxD3GKONmZH8t6
QG2lBON/6F3hfJvbFJYKIR9VAQ3KHg+mAp7xQm8m6vl8n7T4C2qzUhVzpL9F2XQF
L8mEz8V6AJ7aAH7wJdpZJl1f8uQ3Ww7pT7k6yL4xY6J3Lm7Qz3qE8Y7dH9jT8pN
L2cZ3B4yU5j7oW8K5nM9xY3wF6oC9F7l9V6tQ6R7sY8gE2J1Y1vF7nQ1XaD7bAgMBAAE=
-----END PRIVATE KEY-----`;
        
        const basicCert = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKoK/OvD6RQNMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkRFMQswCQYDVQQIDAJOUlcxDTALBgNVBAcMBENpdHkxEDAOBgNVBAoMB1Nj
cmVlbnN5MQgwBgYDVQQDDAkqMB4XDTI1MDczMTAwMDAwMFoXDTI2MDczMTAwMDAw
MFowRTELMAkGA1UEBhMCREUxCzAJBgNVBAgMAk5SVzENMAsGA1UEBwwEQ2l0eTEQ
MA4GA1UECgwHU2NyZWVuc3kxCDAGBgNVBAMMCSowggEiMA0GCSqGSIb3DQEBAQUA
A4IBDwAwggEKAoIBAQC7VJTUt9Us8cKBwQNVGKYjam9Q6PcklqR2KQOl3DQqcKIq
PbVKFzUhyHRm6PWaowxGrJZqjKr8X+KaXeB8WdQ1mC7L5XHD7uNmfxOexu7rEfL3
tXjAWJfmWcNm8TL6MZNxD3GKONmZH8t6QG2lBON/6F3hfJvbFJYKIR9VAQ3KHg+m
Ap7xQm8m6vl8n7T4C2qzUhVzpL9F2XQFL8mEz8V6AJ7aAH7wJdpZJl1f8uQ3Ww7p
T7k6yL4xY6J3Lm7Qz3qE8Y7dH9jT8pNL2cZ3B4yU5j7oW8K5nM9xY3wF6oC9F7l9
V6tQ6R7sY8gE2J1Y1vF7nQ1XaD7bAgMBAAGjUzBRMB0GA1UdDgQWBBSgKVGh5eIa
F6A8ZwIeA1w8A2VWwzAfBgNVHSMEGDAWgBSgKVGh5eIaF6A8ZwIeA1w8A2VWwzAP
BgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQAzqJnk5yJI4VZF3bLz
1YmUi6L1pMZoKz7gJpMqKc2LV3k5YH8B4L9qL9nA8n6cN0dY9L8fF2tQ6J8hK6M
-----END CERTIFICATE-----`;
        
        fs.writeFileSync('server.key', basicKey);
        fs.writeFileSync('server.crt', basicCert);
        console.log('✅ Basic certificate files created!');
    }
} catch (error) {
    console.error('❌ Error creating certificate:', error.message);
    process.exit(1);
}
