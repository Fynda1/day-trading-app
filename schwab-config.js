// Schwab API Configuration
class SchwabAPI {
    constructor() {
        // YOU MUST FILL THESE IN WITH YOUR ACTUAL VALUES
        this.clientId = 'YOUR_APP_KEY_HERE';  // Replace with your App Key
        this.clientSecret = 'YOUR_APP_SECRET_HERE';  // Replace with your App Secret
        this.redirectUri = 'YOUR_REDIRECT_URI_HERE';  // Replace with your registered redirect URI
        
        // Schwab API URLs
        this.baseUrl = 'https://api.schwabapi.com';
        this.authUrl = 'https://api.schwabapi.com/oauth/authorize';
        this.tokenUrl = 'https://api.schwabapi.com/oauth/token';
        
        // Token storage
        this.accessToken = localStorage.getItem('schwab_access_token');
        this.refreshToken = localStorage.getItem('schwab_refresh_token');
        this.tokenExpiry = localStorage.getItem('schwab_token_expiry');
        
        this.accountNumber = null;
    }

    // Step 1: Get authorization URL
    getAuthorizationUrl() {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: 'readonly' // Add more scopes as needed
        });
        
        return `${this.authUrl}?${params.toString()}`;
    }

    // Step 2: Exchange authorization code for tokens
    async getTokens(authorizationCode) {
        try {
            const response = await fetch(this.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${btoa(this.clientId + ':' + this.clientSecret)}`
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: authorizationCode,
                    redirect_uri: this.redirectUri
                })
            });

            if (!response.ok) {
                throw new Error(`Token request failed: ${response.status}`);
            }

            const data = await response.json();
            
            // Store tokens
            this.accessToken = data.access_token;
            this.refreshToken = data.refresh_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000);
            
            // Save to localStorage
            localStorage.setItem('schwab_access_token', this.accessToken);
            localStorage.setItem('schwab_refresh_token', this.refreshToken);
            localStorage.setItem('schwab_token_expiry', this.tokenExpiry);
            
            console.log('✅ Successfully obtained Schwab tokens');
            return true;
        } catch (error) {
            console.error('❌ Failed to get tokens:', error);
            return false;
        }
    }

    // Step 3: Refresh access token when needed
    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await fetch(this.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${btoa(this.clientId + ':' + this.clientSecret)}`
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: this.refreshToken
                })
            });

            if (!response.ok) {
                throw new Error(`Token refresh failed: ${response.status}`);
            }

            const data = await response.json();
            
            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000);
            
            localStorage.setItem('schwab_access_token', this.accessToken);
            localStorage.setItem('schwab_token_expiry', this.tokenExpiry);
            
            console.log('✅ Token refreshed successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to refresh token:', error);
            return false;
        }
    }

    // Check if we need to refresh token
    async ensureValidToken() {
        if (!this.accessToken) {
            throw new Error('No access token. Please authenticate first.');
        }

        if (Date.now() >= this.tokenExpiry - 300000) { // Refresh 5 minutes before expiry
            await this.refreshAccessToken();
        }
    }

    // Make authenticated API request
    async makeRequest(endpoint, options = {}) {
        await this.ensureValidToken();
        
        const url = `${this.baseUrl}${endpoint}`;
        const requestOptions = {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const response = await fetch(url, requestOptions);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        return response.json();
    }

    // Get account information
    async getAccounts() {
        try {
            const data = await this.makeRequest('/trader/v1/accounts');
            if (data && data.length > 0) {
                this.accountNumber = data[0].accountNumber;
                console.log('✅ Account found:', this.accountNumber);
            }
            return data;
        } catch (error) {
            console.error('❌ Failed to get accounts:', error);
            throw error;
        }
    }

    // Get account positions
    async getPositions() {
        if (!this.accountNumber) {
            await this.getAccounts();
        }
        
        return this.makeRequest(`/trader/v1/accounts/${this.accountNumber}/positions`);
    }

    // Get account balance
    async getBalance() {
        if (!this.accountNumber) {
            await this.getAccounts();
        }
        
        return this.makeRequest(`/trader/v1/accounts/${this.accountNumber}`);
    }

    // Get stock quote
    async getQuote(symbol) {
        return this.makeRequest(`/marketdata/v1/quotes?symbols=${symbol}`);
    }

    // Place order
    async placeOrder(orderData) {
        if (!this.accountNumber) {
            await this.getAccounts();
        }
        
        return this.makeRequest(`/trader/v1/accounts/${this.accountNumber}/orders`, {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    }

    // Get orders
    async getOrders() {
        if (!this.accountNumber) {
            await this.getAccounts();
        }
        
        return this.makeRequest(`/trader/v1/accounts/${this.accountNumber}/orders`);
    }

    // Cancel order
    async cancelOrder(orderId) {
        if (!this.accountNumber) {
            await this.getAccounts();
        }
        
        return this.makeRequest(`/trader/v1/accounts/${this.accountNumber}/orders/${orderId}`, {
            method: 'DELETE'
        });
    }

    // Check if authenticated
    isAuthenticated() {
        return !!this.accessToken && Date.now() < this.tokenExpiry;
    }

    // Clear stored tokens (logout)
    logout() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.accountNumber = null;
        
        localStorage.removeItem('schwab_access_token');
        localStorage.removeItem('schwab_refresh_token');
        localStorage.removeItem('schwab_token_expiry');
        
        console.log('✅ Logged out successfully');
    }
}

// Create global instance
window.schwabAPI = new SchwabAPI();
