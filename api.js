// PriceHawk - API & Utility Module
const HawkAPI = {
    // Storage helpers
    storage: {
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(`hawk_${key}`);
                return item ? JSON.parse(item) : defaultValue;
            } catch { return defaultValue; }
        },
        set(key, value) {
            localStorage.setItem(`hawk_${key}`, JSON.stringify(value));
        }
    },

    // Products CRUD
    products: {
        getAll() { return HawkAPI.storage.get('products', []); },
        save(products) { HawkAPI.storage.set('products', products); },
        add(product) {
            const products = this.getAll();
            product.id = Date.now().toString(36);
            product.priceHistory = [{ date: new Date().toISOString(), yourPrice: product.yourPrice, competitorPrice: product.competitorPrice }];
            product.createdAt = new Date().toISOString();
            products.unshift(product);
            this.save(products);
            return product;
        },
        update(id, updates) {
            const products = this.getAll();
            const idx = products.findIndex(p => p.id === id);
            if (idx !== -1) {
                // Add to price history if prices changed
                if (updates.yourPrice !== products[idx].yourPrice || updates.competitorPrice !== products[idx].competitorPrice) {
                    products[idx].priceHistory = products[idx].priceHistory || [];
                    products[idx].priceHistory.push({ date: new Date().toISOString(), yourPrice: updates.yourPrice || products[idx].yourPrice, competitorPrice: updates.competitorPrice || products[idx].competitorPrice });
                }
                Object.assign(products[idx], updates);
                this.save(products);
                return products[idx];
            }
            return null;
        },
        delete(id) {
            let products = this.getAll();
            products = products.filter(p => p.id !== id);
            this.save(products);
        },
        getById(id) {
            return this.getAll().find(p => p.id === id);
        }
    },

    // Competitors
    competitors: {
        getAll() { return HawkAPI.storage.get('competitors', []); },
        save(competitors) { HawkAPI.storage.set('competitors', competitors); },
        add(competitor) {
            const competitors = this.getAll();
            competitor.id = Date.now().toString(36);
            competitor.createdAt = new Date().toISOString();
            competitors.push(competitor);
            this.save(competitors);
            return competitor;
        },
        delete(id) {
            let competitors = this.getAll();
            competitors = competitors.filter(c => c.id !== id);
            this.save(competitors);
        }
    },

    // Alerts
    alerts: {
        getAll() { return HawkAPI.storage.get('alerts', []); },
        save(alerts) { HawkAPI.storage.set('alerts', alerts); },
        add(alert) {
            const alerts = this.getAll();
            alert.id = Date.now().toString(36);
            alert.createdAt = new Date().toISOString();
            alert.triggered = false;
            alerts.unshift(alert);
            this.save(alerts);
            return alert;
        },
        markRead(id) {
            const alerts = this.getAll();
            const alert = alerts.find(a => a.id === id);
            if (alert) alert.read = true;
            this.save(alerts);
        },
        check() {
            const products = HawkAPI.products.getAll();
            const alerts = this.getAll();
            const newAlerts = [];

            products.forEach(product => {
                if (product.alertThreshold) {
                    const diff = Math.abs(product.yourPrice - product.competitorPrice);
                    if (diff >= product.alertThreshold) {
                        const existing = alerts.find(a => a.productId === product.id && !a.resolved);
                        if (!existing) {
                            newAlerts.push({
                                type: 'price_alert',
                                productId: product.id,
                                productName: product.name,
                                message: `Price difference of $${diff.toFixed(2)} exceeds threshold`,
                                yourPrice: product.yourPrice,
                                competitorPrice: product.competitorPrice
                            });
                        }
                    }
                }
            });

            newAlerts.forEach(a => this.add(a));
            return newAlerts;
        }
    },

    // Price scraping simulation
    async scrapePrice(url) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        // Generate simulated price
        return {
            url: url,
            price: parseFloat((50 + Math.random() * 200).toFixed(2)),
            currency: 'USD',
            available: Math.random() > 0.1,
            lastUpdated: new Date().toISOString(),
            simulated: true
        };
    },

    // Analytics
    getAnalytics() {
        const products = this.products.getAll();
        const alerts = this.alerts.getAll();

        let totalYourValue = 0;
        let totalCompetitorValue = 0;
        let higherCount = 0;
        let lowerCount = 0;

        products.forEach(p => {
            totalYourValue += p.yourPrice;
            totalCompetitorValue += p.competitorPrice;
            if (p.yourPrice > p.competitorPrice) higherCount++;
            else if (p.yourPrice < p.competitorPrice) lowerCount++;
        });

        return {
            totalProducts: products.length,
            totalCompetitors: this.competitors.getAll().length,
            activeAlerts: alerts.filter(a => !a.read).length,
            avgDifference: products.length > 0 ? (totalYourValue - totalCompetitorValue) / products.length : 0,
            higherThanCompetitor: higherCount,
            lowerThanCompetitor: lowerCount,
            priceMatch: products.length - higherCount - lowerCount
        };
    },

    // Export
    exportData() {
        return {
            products: this.products.getAll(),
            competitors: this.competitors.getAll(),
            alerts: this.alerts.getAll(),
            exportedAt: new Date().toISOString()
        };
    },

    // Import
    importData(data) {
        if (data.products) this.products.save(data.products);
        if (data.competitors) this.competitors.save(data.competitors);
        if (data.alerts) this.alerts.save(data.alerts);
    },

    // Toast notifications
    toast: {
        show(message, type = 'info') {
            const container = document.getElementById('toast-container') || this.createContainer();
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i><span>${message}</span>`;
            container.appendChild(toast);
            setTimeout(() => toast.classList.add('show'), 10);
            setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
        },
        createContainer() {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
            document.body.appendChild(container);
            const style = document.createElement('style');
            style.textContent = `.toast{display:flex;align-items:center;gap:10px;padding:12px 20px;background:#1e1e3f;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#fff;font-size:14px;transform:translateX(120%);transition:transform 0.3s;}.toast.show{transform:translateX(0);}.toast-success{border-left:3px solid #10b981;}.toast-error{border-left:3px solid #ef4444;}.toast i{font-size:18px;}.toast-success i{color:#10b981;}.toast-error i{color:#ef4444;}`;
            document.head.appendChild(style);
            return container;
        },
        success(msg) { this.show(msg, 'success'); },
        error(msg) { this.show(msg, 'error'); }
    },

    // Format helpers
    format: {
        currency(num) { return '$' + Number(num).toFixed(2); },
        percent(num) { return num.toFixed(1) + '%'; },
        date(d) { return new Date(d).toLocaleDateString(); },
        timeAgo(date) {
            const seconds = Math.floor((new Date() - new Date(date)) / 1000);
            if (seconds < 60) return 'Just now';
            if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
            if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
            return Math.floor(seconds / 86400) + 'd ago';
        }
    }
};

window.HawkAPI = HawkAPI;
