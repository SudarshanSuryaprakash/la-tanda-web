/**
 * La Tanda My Wallet - Transaction Pagination System
 * Handles pagination for transaction history with server-side support
 * Version: 1.0.0
 */

class MyWallet {
    constructor() {
        this.API_BASE = 'https://api.latanda.online';
        this.currentPage = 1;
        this.limit = 20;
        this.totalPages = 0;
        this.totalCount = 0;
        this.currentFilter = '';
        this.currentUser = null;
        this.transactions = [];
        
        this.init();
    }

    async init() {
        try {
            // Load user data from localStorage or auth
            this.loadUserData();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load first page of transactions
            await this.loadTransactions(1);
            
            console.log('✓ My Wallet initialized successfully');
        } catch (error) {
            console.error('✗ Error initializing My Wallet:', error);
            this.showNotification('Error inicializando la cartera: ' + error.message, 'error');
        }
    }

    loadUserData() {
        // Try to get user from localStorage
        const authData = localStorage.getItem('laTandaWeb3Auth');
        if (authData) {
            const parsed = JSON.parse(authData);
            this.currentUser = parsed.user;
        } else {
            // Check for alternative auth location
            const userString = localStorage.getItem('user');
            if (userString) {
                this.currentUser = JSON.parse(userString);
            }
        }

        if (!this.currentUser) {
            throw new Error('Usuario no autenticado. Por favor inicia sesión.');
        }
    }

    setupEventListeners() {
        // Pagination buttons
        document.getElementById('prevBtn')?.addEventListener('click', () => this.previousPage());
        document.getElementById('nextBtn')?.addEventListener('click', () => this.nextPage());
        
        // Page jump
        const pageJumpBtn = document.getElementById('pageJumpBtn');
        const pageJumpInput = document.getElementById('pageJumpInput');
        
        if (pageJumpBtn && pageJumpInput) {
            pageJumpBtn.addEventListener('click', () => this.jumpToPage());
            pageJumpInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.jumpToPage();
            });
        }
        
        // Status filter
        document.getElementById('statusFilter')?.addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.currentPage = 1; // Reset to first page when filtering
            this.loadTransactions(1);
        });
    }

    async loadTransactions(page = 1) {
        try {
            this.showLoading(true);
            
            const payload = {
                user_id: this.currentUser.id,
                page: page,
                limit: this.limit,
                status_filter: this.currentFilter || undefined
            };

            const authToken = this.getAuthToken();
            const response = await fetch(`${this.API_BASE}/api/user/transactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Sesión expirada. Por favor inicia sesión de nuevo.');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error?.message || 'Error al cargar transacciones');
            }

            // Update data
            this.transactions = result.data.transactions || [];
            this.totalCount = result.data.pagination.total_count;
            this.totalPages = result.data.pagination.total_pages;
            this.currentPage = page;
            
            // Update UI
            this.updateBalance(result.data.balance, result.data.currency);
            this.renderTransactions();
            this.updatePaginationControls();
            
            console.log(`✓ Loaded page ${page} of ${this.totalPages} (${this.totalCount} total transactions)`);
        } catch (error) {
            console.error('Error loading transactions:', error);
            this.showNotification(error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    updateBalance(balance, currency) {
        const balanceElement = document.getElementById('availableBalance');
        const currencyElement = document.getElementById('currencyDisplay');
        
        if (balanceElement) {
            balanceElement.textContent = `${currency} ${parseFloat(balance).toFixed(2)}`;
        }
        if (currencyElement) {
            currencyElement.textContent = currency;
        }
    }

    renderTransactions() {
        const listContainer = document.getElementById('transactionsList');
        const noTransactionsMsg = document.getElementById('noTransactionsMessage');
        
        if (!listContainer) return;

        if (this.transactions.length === 0) {
            listContainer.innerHTML = '';
            noTransactionsMsg?.classList.remove('hidden');
            return;
        }

        noTransactionsMsg?.classList.add('hidden');
        
        listContainer.innerHTML = this.transactions.map(tx => this.createTransactionHTML(tx)).join('');
    }

    createTransactionHTML(transaction) {
        const date = new Date(transaction.date);
        const formattedDate = date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const amountClass = transaction.amount >= 0 ? 'positive' : 'negative';
        const amountSign = transaction.amount >= 0 ? '+' : '';
        const statusClass = `status-${transaction.status?.toLowerCase() || 'pending'}`;
        const statusText = this.getStatusText(transaction.status);
        const typeText = this.getTransactionTypeText(transaction.type);

        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-type">${typeText}</div>
                    <div class="transaction-description">${transaction.description || 'Sin descripción'}</div>
                    <div class="transaction-date">${formattedDate}</div>
                </div>
                <div class="transaction-amount ${amountClass}">
                    ${amountSign}L. ${Math.abs(transaction.amount).toFixed(2)}
                </div>
                <div class="transaction-status ${statusClass}">
                    ${statusText}
                </div>
            </div>
        `;
    }

    getTransactionTypeText(type) {
        const typeMap = {
            'contribution': '💰 Contribución',
            'transaction': '🔄 Transferencia',
            'deposit': '📥 Depósito',
            'withdraw': '📤 Retiro',
            'lock_for_tanda': '🔒 Bloqueado para Tanda',
            'unlock_tanda': '🔓 Desbloqueado',
            'ltd_mint': '🪙 Minería de LTD',
            'ltd_burn': '🔥 Quema de LTD'
        };
        return typeMap[type] || type;
    }

    getStatusText(status) {
        const statusMap = {
            'completed': 'Completada',
            'pending': 'Pendiente',
            'failed': 'Fallida',
            'processing': 'Procesando'
        };
        return statusMap[status?.toLowerCase()] || status || 'Desconocido';
    }

    updatePaginationControls() {
        const pageIndicator = document.getElementById('pageIndicator');
        const transactionCount = document.getElementById('transactionCount');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const paginationControls = document.getElementById('paginationControls');

        // Update text indicators
        if (pageIndicator) {
            pageIndicator.textContent = `Página ${this.currentPage} de ${this.totalPages}`;
        }
        if (transactionCount) {
            transactionCount.textContent = `${this.totalCount} transacciones`;
        }

        // Update button states
        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= this.totalPages;
        }

        // Hide pagination controls if only one page
        if (paginationControls) {
            paginationControls.classList.toggle('hidden', this.totalPages <= 1);
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.loadTransactions(this.currentPage - 1);
            this.scrollToTop();
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.loadTransactions(this.currentPage + 1);
            this.scrollToTop();
        }
    }

    jumpToPage() {
        const input = document.getElementById('pageJumpInput');
        if (!input) return;

        const page = parseInt(input.value, 10);

        if (isNaN(page) || page < 1 || page > this.totalPages) {
            this.showNotification(
                `Por favor ingresa un número entre 1 y ${this.totalPages}`,
                'error'
            );
            return;
        }

        this.loadTransactions(page);
        input.value = '';
        this.scrollToTop();
    }

    scrollToTop() {
        const transactionsSection = document.querySelector('.transactions-section');
        if (transactionsSection) {
            transactionsSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    showLoading(show) {
        const loader = document.getElementById('loadingIndicator');
        const list = document.getElementById('transactionsList');
        
        if (loader) {
            loader.classList.toggle('hidden', !show);
        }
        if (list && show) {
            list.innerHTML = '';
        }
    }

    getAuthToken() {
        // Try multiple places to find the auth token
        const authData = localStorage.getItem('laTandaWeb3Auth');
        if (authData) {
            try {
                const parsed = JSON.parse(authData);
                return parsed.token || parsed.access_token || '';
            } catch (e) {
                console.warn('Could not parse auth data');
            }
        }

        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (token) return token;

        // If no token found, user should be redirected to login
        throw new Error('No authentication token found');
    }

    showNotification(message, type = 'info') {
        // Create a simple notification (can be enhanced)
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // Try to use browser's native notification if available
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('La Tanda Wallet', {
                body: message,
                icon: '/favicon.ico'
            });
        }
    }
}

// Initialize wallet when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new MyWallet();
    });
} else {
    new MyWallet();
}
