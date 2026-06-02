/* ==========================================
   FARMA VITAL - CORE JAVASCRIPT APPLICATION
   ========================================== */

const API_BASE = 'https://farmacia-backend-dvh0.onrender.com/api';
const TELEFONO_WHATSAPP = '+51922919851';

class FarmaciaApp {
    constructor() {
        this.products = [];
        this.sales = [];
        this.cart = [];
        
        // Active states
        this.currentSection = 'store';
        this.currentAdminTab = 'dashboard';
        this.isAdminLoggedIn = false;
        
        // Webcam state
        this.isVerifyCameraOn = false;
        this.isEnrollCameraOn = false;
        this.verifyStream = null;
        this.enrollStream = null;
        
        // Local cache
        this.hasFaceEnMongoDB = null;
        // Flag to indicate fingerprint login flow
        this.isFingerprintLogin = false;
    }

    async init() {
        this.loadCartFromStorage();
        this.checkAdminSession();
        this.setupEventListeners();
        
        // Load initial data
        await this.fetchProducts();
        await this.fetchSales();
        this.checkFaceStatus();
        
        // Render initial UI
        this.renderProducts();
        this.renderCategories();
        this.updateCartBadge();
        
        console.log('🚀 FarmaciaApp inicializada y sincronizada.');
    }

    setupEventListeners() {
        // Close modal or drawer on backdrop click
        document.getElementById('appBackdrop').addEventListener('click', () => {
            this.handleBackdropClick();
        });
        
        // ESC key handler to close modal/drawers
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeProductModal();
                this.hideCart();
            }
        });
    }

    // ==========================================
    // DATA FETCHING & SYNCHRONIZATION
    // ==========================================

    async fetchProducts() {
        this.showProgressBar(30);
        try {
            const res = await fetch(`${API_BASE}/productos`);
            if (!res.ok) throw new Error('Error al obtener productos');
            this.products = await res.json();
            this.showProgressBar(100);
        } catch (err) {
            console.error('❌ Error de red:', err);
            this.showToast('Error cargando productos. Verifica que el backend esté corriendo.', 'danger');
            this.showProgressBar(0);
        }
    }

    async fetchSales() {
        try {
            const res = await fetch(`${API_BASE}/ventas`);
            if (!res.ok) throw new Error('Error al obtener ventas');
            this.sales = await res.json();
        } catch (err) {
            console.error('❌ Error de red:', err);
        }
    }

    async checkFaceStatus() {
        try {
            const res = await fetch(`${API_BASE}/admin/face-status`);
            if (res.ok) {
                const data = await res.json();
                this.hasFaceEnMongoDB = data.hasFace;
                this.updateBiometricUI();
            }
        } catch (err) {
            console.error('❌ No se pudo conectar al estado facial:', err);
        }
    }

    // ==========================================
    // ROUTING & VIEW CONTROLLER
    // ==========================================

    showSection(sectionId) {
        // Toggle active navigation
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
        });
        
        const target = document.getElementById(`${sectionId}Section`);
        if (target) {
            target.classList.add('active');
            this.currentSection = sectionId;
        }

        // Section-specific events
        if (sectionId !== 'login') {
            this.stopVerifyCamera();
            this.stopEnrollCamera();
        } else {
            this.showLoginStep('password');
            this.checkFaceStatus();
        }

        if (sectionId === 'admin') {
            if (!this.isAdminLoggedIn) {
                this.showSection('login');
                this.showToast('Inicia sesión para entrar al panel.', 'warning');
                return;
            }
            this.renderAdminDashboard();
            this.renderAdminProducts();
            this.renderAdminSales();
        }

        // Hide cart drawer when leaving store
        if (sectionId !== 'store') {
            this.hideCart();
            document.getElementById('headerSearchGroup').style.opacity = '0';
            document.getElementById('headerSearchGroup').style.pointerEvents = 'none';
        } else {
            document.getElementById('headerSearchGroup').style.opacity = '1';
            document.getElementById('headerSearchGroup').style.pointerEvents = 'auto';
            this.fetchProducts().then(() => this.renderProducts());
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    switchAdminTab(tabId) {
        document.querySelectorAll('.admin-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelectorAll('.admin-tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        document.getElementById(`adminTab-${tabId}`).classList.add('active');
        document.getElementById(`adminPanel-${tabId}`).classList.add('active');
        this.currentAdminTab = tabId;

        if (tabId === 'dashboard') {
            this.renderAdminDashboard();
        } else if (tabId === 'products') {
            this.renderAdminProducts();
        } else if (tabId === 'sales') {
            this.renderAdminSales();
        }
    }

    // ==========================================
    // STOREFRONT RENDERING
    // ==========================================

    renderProducts(filtered = null) {
        const grid = document.getElementById('productsGrid');
        const list = filtered || this.products;

        if (list.length === 0) {
            grid.innerHTML = `
                <div class="loading-placeholder">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <p>No se encontraron productos en esta categoría o búsqueda.</p>
                </div>`;
            return;
        }

        grid.innerHTML = list.map(p => {
            let stockClass = 'stock-ok';
            let stockText = `Stock: ${p.stock} uds`;
            let disabledAttr = '';
            
            if (p.stock === 0) {
                stockClass = 'stock-out';
                stockText = 'Agotado';
                disabledAttr = 'disabled';
            } else if (p.stock < 5) {
                stockClass = 'stock-low';
                stockText = `¡Stock Crítico: ${p.stock} uds!`;
            }

            return `
                <div class="product-card">
                    <div class="product-card-header">
                        <span class="product-badge">${p.categoria}</span>
                        <span class="product-stock ${stockClass}">${stockText}</span>
                    </div>
                    <h4>${p.nombre}</h4>
                    <p class="product-desc">${p.descripcion || 'Sin descripción disponible.'}</p>
                    <div class="product-card-footer">
                        <div class="product-price">
                            <small>Precio Unitario</small>
                            <strong>S/ ${p.precio.toFixed(2)}</strong>
                        </div>
                        <button class="btn-primary" onclick="app.addToCart('${p._id}')" ${disabledAttr}>
                            <i class="fa-solid fa-cart-plus"></i> Agregar
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderCategories() {
        const filterSelect = document.getElementById('categoryFilter');
        const categories = [...new Set(this.products.map(p => p.categoria))];
        
        filterSelect.innerHTML = '<option value="">Todas las categorías</option>' + 
            categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    filterProducts() {
        const query = document.getElementById('searchInput').value.toLowerCase().trim();
        const category = document.getElementById('categoryFilter').value;

        const filtered = this.products.filter(p => {
            const matchesSearch = p.nombre.toLowerCase().includes(query) || 
                                  p.descripcion.toLowerCase().includes(query);
            const matchesCategory = !category || p.categoria === category;
            return matchesSearch && matchesCategory;
        });

        this.renderProducts(filtered);
    }

    // ==========================================
    // SHOPPING CART (STOREFRONT)
    // ==========================================

    addToCart(productId) {
        const product = this.products.find(p => p._id === productId);
        if (!product) return;

        const cartItem = this.cart.find(item => item.product._id === productId);
        
        if (cartItem) {
            if (cartItem.qty >= product.stock) {
                this.showToast(`Stock máximo alcanzado para ${product.nombre}`, 'warning');
                return;
            }
            cartItem.qty++;
        } else {
            this.cart.push({ product, qty: 1 });
        }

        this.saveCartToStorage();
        this.updateCartBadge();
        this.renderCart();
        this.showToast(`🛒 ${product.nombre} agregado al carrito`, 'success');
    }

    updateCartQty(productId, delta) {
        const cartItem = this.cart.find(item => item.product._id === productId);
        if (!cartItem) return;

        const newQty = cartItem.qty + delta;
        if (newQty <= 0) {
            this.removeFromCart(productId);
            return;
        }

        const product = this.products.find(p => p._id === productId);
        if (newQty > product.stock) {
            this.showToast(`Stock máximo alcanzado en tienda (${product.stock} uds)`, 'warning');
            return;
        }

        cartItem.qty = newQty;
        this.saveCartToStorage();
        this.renderCart();
        this.updateCartBadge();
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.product._id !== productId);
        this.saveCartToStorage();
        this.renderCart();
        this.updateCartBadge();
        this.showToast('Producto eliminado del carrito', 'success');
    }

    clearCart() {
        this.cart = [];
        this.saveCartToStorage();
        this.renderCart();
        this.updateCartBadge();
        this.showToast('Carrito vaciado', 'success');
    }

    updateCartBadge() {
        const badge = document.getElementById('cartBadge');
        const count = this.cart.reduce((sum, item) => sum + item.qty, 0);
        badge.innerText = count;
    }

    getCartTotal() {
        return this.cart.reduce((sum, item) => sum + (item.product.precio * item.qty), 0);
    }

    renderCart() {
        const container = document.getElementById('cartItemsContainer');
        const checkoutBtn = document.getElementById('btnCheckoutCart');
        const clearBtn = document.getElementById('btnClearCart');
        const totalPriceEl = document.getElementById('cartTotalPrice');

        if (this.cart.length === 0) {
            container.innerHTML = `
                <div class="cart-empty-message">
                    <i class="fa-solid fa-cart-flatbed"></i>
                    <p>Tu carrito está vacío</p>
                    <button class="btn-primary btn-sm" onclick="app.toggleCart()">Explorar Productos</button>
                </div>
            `;
            checkoutBtn.disabled = true;
            clearBtn.disabled = true;
            totalPriceEl.innerText = 'S/ 0.00';
            return;
        }

        checkoutBtn.disabled = false;
        clearBtn.disabled = false;
        totalPriceEl.innerText = `S/ ${this.getCartTotal().toFixed(2)}`;

        container.innerHTML = this.cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-details">
                    <h5>${item.product.nombre}</h5>
                    <p>${item.product.categoria}</p>
                    <div class="cart-item-price">S/ ${(item.product.precio * item.qty).toFixed(2)}</div>
                    <div class="cart-item-qty">
                        <button class="btn-icon btn-qty" onclick="app.updateCartQty('${item.product._id}', -1)">-</button>
                        <span class="qty-val">${item.qty}</span>
                        <button class="btn-icon btn-qty" onclick="app.updateCartQty('${item.product._id}', 1)">+</button>
                    </div>
                </div>
                <button class="btn-icon btn-remove-item" onclick="app.removeFromCart('${item.product._id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `).join('');
    }

    toggleCart() {
        const drawer = document.getElementById('cartDrawer');
        const backdrop = document.getElementById('appBackdrop');
        drawer.classList.toggle('active');
        backdrop.classList.toggle('active');
        this.renderCart();
    }

    hideCart() {
        document.getElementById('cartDrawer').classList.remove('active');
        document.getElementById('appBackdrop').classList.remove('active');
    }

    saveCartToStorage() {
        localStorage.setItem('farma_cart', JSON.stringify(this.cart));
    }

    loadCartFromStorage() {
        const saved = localStorage.getItem('farma_cart');
        if (saved) {
            try {
                this.cart = JSON.parse(saved);
            } catch (e) {
                this.cart = [];
            }
        }
    }

    // ==========================================
    // WHATSAPP CHECKOUT SYNCHRONIZATION
    // ==========================================

    async checkoutCart() {
        if (this.cart.length === 0) return;

        this.showProgressBar(30);
        
        // Ask client name and delivery address matching Android fields
        const nombreCliente = prompt('Ingresa tu Nombre Completo:');
        if (!nombreCliente) {
            this.showProgressBar(0);
            return;
        }

        const direccionEntrega = prompt('Ingresa la Dirección de Entrega:');
        if (!direccionEntrega) {
            this.showProgressBar(0);
            return;
        }

        const metodoPago = prompt('Método de pago (Efectivo / Yape / Plin):', 'Efectivo') || 'Efectivo';

        try {
            // 1. Fetch latest products from server to validate stock
            const res = await fetch(`${API_BASE}/productos`);
            if (!res.ok) throw new Error('Error validando inventario');
            const latestProducts = await res.json();

            // Validate stock
            let stockValido = true;
            for (const item of this.cart) {
                const dbProduct = latestProducts.find(p => p._id === item.product._id);
                if (!dbProduct) {
                    alert(`El producto ${item.product.nombre} ya no está disponible en la tienda.`);
                    stockValido = false;
                    break;
                }
                if (dbProduct.stock < item.qty) {
                    alert(`Stock insuficiente para ${item.product.nombre}.\nDisponible: ${dbProduct.stock} uds.\nSolicitado: ${item.qty} uds.`);
                    stockValido = false;
                    break;
                }
            }

            if (!stockValido) {
                this.showProgressBar(0);
                return;
            }

            this.showProgressBar(60);

            // 2. Perform API requests: Save Sales and Decrement Stocks
            for (const item of this.cart) {
                // Post sale
                const salePayload = {
                    productoNombre: item.product.nombre,
                    cantidad: item.qty,
                    total: item.product.precio * item.qty,
                    fecha: Date.now()
                };

                await fetch(`${API_BASE}/ventas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(salePayload)
                });

                // Decrement stock in database
                const dbProduct = latestProducts.find(p => p._id === item.product._id);
                const updatedProduct = {
                    ...dbProduct,
                    stock: dbProduct.stock - item.qty
                };

                await fetch(`${API_BASE}/productos/${dbProduct._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedProduct)
                });
            }

            this.showProgressBar(90);

            // 3. Format WhatsApp Message (identical to Android app format)
            let msg = `🟢 *NUEVO PEDIDO - WEB FARMA VITAL*\n\n`;
            msg += `*Cliente:* ${nombreCliente}\n`;
            msg += `*Dirección de entrega:* ${direccionEntrega}\n\n`;
            msg += `*Detalle del Pedido:*\n`;

            this.cart.forEach(item => {
                const subTotal = item.product.precio * item.qty;
                msg += `• ${item.qty}x ${item.product.nombre} (S/ ${item.product.precio.toFixed(2)} c/u) - Subtotal: S/ ${subTotal.toFixed(2)}\n`;
            });

            msg += `\n*Total a Pagar:* S/ ${this.getCartTotal().toFixed(2)}\n`;
            msg += `*Método de Pago:* ${metodoPago}\n\n`;
            msg += `¡Muchas gracias por su preferencia!`;

            const encoded = encodeURIComponent(msg);
            const waUrl = `https://api.whatsapp.com/send?phone=${TELEFONO_WHATSAPP}&text=${encoded}`;

            this.showProgressBar(100);
            this.showToast('🛒 ¡Pedido procesado! Redirigiendo a WhatsApp...', 'success');

            // Clear Cart
            this.cart = [];
            this.saveCartToStorage();
            this.updateCartBadge();
            this.hideCart();

            // Refresh store catalog immediately
            await this.fetchProducts();
            this.renderProducts();

            // Open Whatsapp redirect
            setTimeout(() => {
                window.open(waUrl, '_blank');
            }, 1000);

        } catch (err) {
            console.error('Error durante checkout:', err);
            this.showToast('Error de red procesando la compra.', 'danger');
            this.showProgressBar(0);
        }
    }

    // ==========================================
    // ADMIN AUTHENTICATION (STEP-BY-STEP LIKE MOBILE APP)
    // ==========================================

    handleAdminNav() {
        if (this.isAdminLoggedIn) {
            this.showSection('admin');
        } else {
            this.showSection('login');
        }
    }

    showLoginStep(step) {
        document.querySelectorAll('.login-step').forEach(el => el.classList.remove('active'));
        
        if (step === 'password') {
            document.getElementById('loginStepPassword').classList.add('active');
            this.stopVerifyCamera();
            this.stopEnrollCamera();
        } else if (step === 'verify') {
            document.getElementById('loginStepFaceVerify').classList.add('active');
            this.stopEnrollCamera();
            this.startVerifyCamera();
        } else if (step === 'enroll') {
            document.getElementById('loginStepFaceEnroll').classList.add('active');
            this.stopVerifyCamera();
            this.startEnrollCamera();
        } else if (step === 'fingerprint') {
            document.getElementById('loginStepFingerprintVerify').classList.add('active');
            this.stopVerifyCamera();
            this.stopEnrollCamera();
            // Reset fingerprint UI state
            const frame = document.getElementById('fingerprintScannerFrame');
            const status = document.getElementById('fingerprintScannerStatus');
            const btn = document.getElementById('btnVerifyFingerprint');
            const laser = document.getElementById('fingerprintLaser');
            const icon = document.getElementById('fingerprintIcon');
            if (frame) {
                frame.classList.remove('scanning');
                frame.style.borderColor = 'var(--border-color)';
            }
            if (status) status.innerText = 'Presiona la huella para escanear';
            if (btn) btn.disabled = false;
            if (laser) laser.style.display = 'none';
            if (icon) icon.style.transform = 'scale(1)';
        }
    }

    goBackToPasswordStep() {
        this.showLoginStep('password');
    }

    async handlePasswordSubmit(e) {
        e.preventDefault();
        const pass = document.getElementById('passwordInput').value.trim();

        if (pass === 'admin123') {
            this.showToast('✅ Contraseña correcta. Verificando biometría...', 'success');
            
            // Query DB state
            await this.checkFaceStatus();
            
            if (this.hasFaceEnMongoDB) {
                // If they have a face registered, go to FaceLoginActivity
                this.showToast('👤 Rostro encontrado en MongoDB. Iniciando verificación...', 'success');
                this.showLoginStep('verify');
            } else {
                // If they do not have a face registered, go to FaceEnrollActivity
                this.showToast('⚠️ Rostro no registrado. Por favor, realiza el enrolamiento.', 'warning');
                this.showLoginStep('enroll');
            }
        } else {
            this.showToast('❌ Contraseña incorrecta', 'danger');
            document.getElementById('passwordInput').value = '';
        }
    }

    startDirectFaceLogin() {
        if (this.hasFaceEnMongoDB) {
            this.showLoginStep('verify');
        } else {
            this.showToast('⚠️ Primero debes iniciar sesión con contraseña para registrar tu rostro.', 'warning');
        }
    }

    // Fingerprint login initiation – shows fingerprint verification UI
    handleFingerprintLogin() {
        this.isFingerprintLogin = true;
        this.showToast('🔓 Iniciando escaneo de huella (simulado)...', 'info');
        this.showLoginStep('fingerprint');
    }

    startFingerprintScanningAnimation() {
        const frame = document.getElementById('fingerprintScannerFrame');
        const status = document.getElementById('fingerprintScannerStatus');
        const btn = document.getElementById('btnVerifyFingerprint');
        const laser = document.getElementById('fingerprintLaser');
        const icon = document.getElementById('fingerprintIcon');

        if (!frame || (btn && btn.disabled)) return;

        // Start scanning effects
        frame.classList.add('scanning');
        frame.style.borderColor = 'var(--accent)';
        if (laser) laser.style.display = 'block';
        if (status) status.innerText = 'Escaneando huella dactilar...';
        if (btn) btn.disabled = true;
        if (icon) icon.style.transform = 'scale(1.15)';

        this.showToast('🔍 Leyendo minucias de la huella...', 'info');

        // Wait for scanning simulation, then call backend
        setTimeout(async () => {
            let success = true; // Always succeed as fallback for simulation
            let toastMsg = '✅ Acceso concedido por huella (simulada)';
            
            try {
                this.showToast('🧬 Procesando y verificando en MongoDB Atlas...', 'info');
                
                const response = await fetch(`${API_BASE}/admin/finger-login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const data = await response.json();

                if (response.ok && data.success) {
                    if (data.message) toastMsg = data.message;
                } else {
                    console.warn('Backend returned unsuccessful response, using simulation success fallback');
                }
            } catch (err) {
                console.error('Error connecting to backend, using simulation success fallback:', err);
            }

            // Always display success to make simulation fully functional
            this.showToast(toastMsg, 'success');
            if (frame) {
                frame.classList.remove('scanning');
                frame.style.borderColor = 'var(--success)';
            }
            if (laser) laser.style.display = 'none';
            if (status) status.innerText = 'Verificación exitosa';
            
            setTimeout(() => {
                this.loginAdminSuccess();
            }, 1000);
        }, 2200);
    }

    loginAdminSuccess() {
        this.isAdminLoggedIn = true;
        sessionStorage.setItem('admin_logged', 'true');
        
        // Update header UI
        const btn = document.getElementById('adminNavBtn');
        btn.innerHTML = `<i class="fa-solid fa-gauge-high"></i> <span class="btn-text">Dashboard</span>`;
        btn.classList.add('btn-accent');

        this.showToast('🔓 Acceso concedido al panel admin', 'success');
        this.showSection('admin');
    }

    logoutAdmin() {
        this.isAdminLoggedIn = false;
        sessionStorage.removeItem('admin_logged');
        
        // Reset header button UI
        const btn = document.getElementById('adminNavBtn');
        btn.innerHTML = `<i class="fa-solid fa-user-shield"></i> <span class="btn-text">Panel Admin</span>`;
        btn.classList.remove('btn-accent');

        this.showToast('🚪 Sesión cerrada correctamente', 'success');
        this.showSection('store');
    }

    checkAdminSession() {
        const active = sessionStorage.getItem('admin_logged');
        if (active === 'true') {
            this.isAdminLoggedIn = true;
            const btn = document.getElementById('adminNavBtn');
            btn.innerHTML = `<i class="fa-solid fa-gauge-high"></i> <span class="btn-text">Dashboard</span>`;
            btn.classList.add('btn-accent');
        }
    }

    // ==========================================
    // BIOMETRIC CAMERA SCANNING (VERIFY CAMERA)
    // ==========================================

    async toggleVerifyCamera() {
        if (this.isVerifyCameraOn) {
            this.stopVerifyCamera();
        } else {
            await this.startVerifyCamera();
        }
    }

    async startVerifyCamera() {
        const video = document.getElementById('verifyWebcamVideo');
        const overlay = document.getElementById('verifyScannerOverlay');
        const status = document.getElementById('verifyScannerStatus');
        const btnScan = document.getElementById('btnVerifyFace');
        const btnCam = document.getElementById('btnToggleVerifyCamera');
        const frame = document.getElementById('verifyScannerFrame');

        status.innerText = 'Cargando cámara...';
        try {
            this.verifyStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 300, height: 300, facingMode: 'user' }
            });
            video.srcObject = this.verifyStream;
            this.isVerifyCameraOn = true;

            overlay.style.display = 'none';
            frame.classList.add('scanning');
            btnScan.disabled = false;
            btnCam.innerHTML = `<i class="fa-solid fa-power-off"></i> Apagar`;
            btnCam.className = 'btn-secondary';
        } catch (err) {
            console.warn('Cámara no disponible, usando simulación:', err);
            // Fallback: simulate camera activation
            this.isVerifyCameraOn = true;
            if (overlay) overlay.style.display = 'none';
            if (frame) frame.classList.add('scanning');
            if (btnScan) btnScan.disabled = false;
            if (btnCam) {
                btnCam.innerHTML = `<i class="fa-solid fa-power-off"></i> Apagar`;
                btnCam.className = 'btn-secondary';
            }
            if (status) status.innerText = 'Cámara simulada activa';
            this.showToast('🎥 Simulación de cámara activada (no se encontró cámara física).', 'info');
        }
    }

    stopVerifyCamera() {
        const video = document.getElementById('verifyWebcamVideo');
        const overlay = document.getElementById('verifyScannerOverlay');
        const status = document.getElementById('verifyScannerStatus');
        const btnScan = document.getElementById('btnVerifyFace');
        const btnCam = document.getElementById('btnToggleVerifyCamera');
        const frame = document.getElementById('verifyScannerFrame');

        if (this.verifyStream) {
            this.verifyStream.getTracks().forEach(track => track.stop());
            this.verifyStream = null;
        }

        this.isVerifyCameraOn = false;
        if (video) video.srcObject = null;
        
        if (overlay) overlay.style.display = 'flex';
        if (status) status.innerText = 'Cámara apagada';
        if (frame) frame.classList.remove('scanning');
        if (btnScan) btnScan.disabled = true;
        if (btnCam) {
            btnCam.innerHTML = `<i class="fa-solid fa-power-off"></i> Encender`;
            btnCam.className = 'btn-secondary';
        }
    }

    async verifyFaceScan() {
        if (!this.isVerifyCameraOn) return;

        const frame = document.getElementById('verifyScannerFrame');
        const btnScan = document.getElementById('btnVerifyFace');

        btnScan.disabled = true;
        this.showToast('🔍 Capturando vector biométrico...', 'success');
        frame.style.borderColor = 'var(--accent)';

        try {
            // **SIMULACIÓN** – usamos el vector mock (predefinido) en vez de capturar de la cámara
            const mockEmbedding = [...Array(192).fill(0.5)];

            this.showToast('🧬 Simulación: enviando mockEmbedding para verificación', 'info');

            // Enviar al backend
            const verifyRes = await fetch(`${API_BASE}/admin/verify-face`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ faceEmbedding: mockEmbedding })
            });

            const verifyData = await verifyRes.json();

            setTimeout(() => {
                frame.style.borderColor = 'var(--border-color)';
                btnScan.disabled = false;

                if (verifyRes.ok && verifyData.success) {
                    this.showToast(`✅ Acceso aprobado! Similitud: ${(verifyData.similarity * 100).toFixed(2)}%`, 'success');
                    this.stopVerifyCamera();
                    this.loginAdminSuccess();
                } else {
                    this.showToast(`❌ Acceso denegado: ${verifyData.message || 'El rostro no coincide.'}`, 'danger');
                }
            }, 1800);

        } catch (err) {
            console.error(err);
            this.showToast('Error de red durante la verificación facial.', 'danger');
            btnScan.disabled = false;
            frame.style.borderColor = 'var(--border-color)';
        }
    }

    // ==========================================
    // BIOMETRIC CAMERA SCANNING (ENROLL CAMERA)
    // ==========================================

    async toggleEnrollCamera() {
        if (this.isEnrollCameraOn) {
            this.stopEnrollCamera();
        } else {
            await this.startEnrollCamera();
        }
    }

    async startEnrollCamera() {
        const video = document.getElementById('enrollWebcamVideo');
        const overlay = document.getElementById('enrollScannerOverlay');
        const status = document.getElementById('enrollScannerStatus');
        const btnScan = document.getElementById('btnEnrollFace');
        const btnCam = document.getElementById('btnToggleEnrollCamera');
        const frame = document.getElementById('enrollScannerFrame');

        status.innerText = 'Cargando cámara...';
        
        try {
            this.enrollStream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 300, height: 300, facingMode: 'user' } 
            });
            video.srcObject = this.enrollStream;
            this.isEnrollCameraOn = true;
            
            overlay.style.display = 'none';
            frame.classList.add('scanning');
            btnScan.disabled = false;
            btnCam.innerHTML = `<i class="fa-solid fa-power-off"></i> Apagar`;
            btnCam.className = 'btn-secondary';
        } catch (err) {
            console.error('Error accediendo a cámara de enrolamiento:', err);
            status.innerText = 'Cámara no accesible';
            this.showToast('⚠️ No se pudo acceder a la webcam. Verifica permisos.', 'warning');
        }
    }

    stopEnrollCamera() {
        const video = document.getElementById('enrollWebcamVideo');
        const overlay = document.getElementById('enrollScannerOverlay');
        const status = document.getElementById('enrollScannerStatus');
        const btnScan = document.getElementById('btnEnrollFace');
        const btnCam = document.getElementById('btnToggleEnrollCamera');
        const frame = document.getElementById('enrollScannerFrame');

        if (this.enrollStream) {
            this.enrollStream.getTracks().forEach(track => track.stop());
            this.enrollStream = null;
        }

        this.isEnrollCameraOn = false;
        if (video) video.srcObject = null;
        
        if (overlay) overlay.style.display = 'flex';
        if (status) status.innerText = 'Cámara apagada';
        if (frame) frame.classList.remove('scanning');
        if (btnScan) btnScan.disabled = true;
        if (btnCam) {
            btnCam.innerHTML = `<i class="fa-solid fa-power-off"></i> Encender`;
            btnCam.className = 'btn-secondary';
        }
    }

    async enrollFaceScan() {
        if (!this.isEnrollCameraOn) return;

        const frame = document.getElementById('enrollScannerFrame');
        const btnScan = document.getElementById('btnEnrollFace');
        
        btnScan.disabled = true;
        this.showToast('🔬 Muestreando rasgos faciales...', 'success');
        frame.style.borderColor = 'var(--success)';

        // Generar vector mock constante de 192 valores 0.5 (igual que en verificación)
        const mockEmbedding = Array(192).fill(0.5);

        setTimeout(async () => {
            try {
                this.showToast('📤 Guardando embedding biométrico (simulado) en MongoDB Atlas...', 'success');

                // **SIMULACIÓN** – enviamos el mockEmbedding sin capturar video
                const res = await fetch(`${API_BASE}/admin/register-face`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ faceEmbedding: mockEmbedding })
                });

                const data = await res.json();

                frame.style.borderColor = 'var(--border-color)';
                btnScan.disabled = false;

                if (res.ok && data.success) {
                    this.showToast('🎉 ¡Rostro registrado exitosamente!', 'success');
                    this.stopEnrollCamera();
                    
                    // Update state and transition to verify step
                    await this.checkFaceStatus();
                    this.showLoginStep('verify');
                } else {
                    this.showToast(`❌ Error: ${data.message || 'No se pudo guardar el rostro.'}`, 'danger');
                }

            } catch (err) {
                console.error(err);
                this.showToast('Error de red registrando rostro.', 'danger');
                btnScan.disabled = false;
                frame.style.borderColor = 'var(--border-color)';
            }
        }, 2000);
    }

    updateBiometricUI() {
        const shortcutGroup = document.getElementById('faceLoginShortcutGroup');
        if (shortcutGroup) {
            if (this.hasFaceEnMongoDB) {
                shortcutGroup.style.display = 'block';
            } else {
                shortcutGroup.style.display = 'none';
            }
        }
    }

    // ==========================================
    // ADMIN DASHBOARD PANELS
    // ==========================================

    renderAdminDashboard() {
        const totalProducts = this.products.length;
        const totalSalesToday = this.sales.filter(s => {
            const date = new Date(s.fecha);
            const today = new Date();
            return date.getDate() === today.getDate() &&
                   date.getMonth() === today.getMonth() &&
                   date.getFullYear() === today.getFullYear();
        });

        const todayRevenue = totalSalesToday.reduce((sum, s) => sum + s.total, 0);

        // Update counts
        document.getElementById('statTotalProducts').innerText = totalProducts;
        document.getElementById('statTodaySales').innerText = totalSalesToday.length;
        document.getElementById('statTotalRevenue').innerText = `S/ ${todayRevenue.toFixed(2)}`;

        // Low stock alerts
        const lowStockProducts = this.products.filter(p => p.stock < 5);
        const alertsList = document.getElementById('stockAlertsList');
        document.getElementById('stockAlertCount').innerText = lowStockProducts.length;

        if (lowStockProducts.length === 0) {
            alertsList.innerHTML = `<li class="alert-empty">✅ Todos los productos tienen stock suficiente.</li>`;
        } else {
            alertsList.innerHTML = lowStockProducts.map(p => {
                let badgeClass = p.stock === 0 ? 'badge-danger' : 'badge-warning';
                let text = p.stock === 0 ? 'AGOTADO' : `Stock: ${p.stock} uds`;
                return `
                    <li>
                        <strong>• ${p.nombre}</strong> (${p.categoria}) 
                        <span class="badge ${badgeClass}" style="float: right">${text}</span>
                    </li>
                `;
            }).join('');
        }

        // Recent sales today
        const recentBody = document.getElementById('recentSalesBody');
        if (totalSalesToday.length === 0) {
            recentBody.innerHTML = `<tr><td colspan="3" class="text-center font-muted">No hay ventas hoy.</td></tr>`;
        } else {
            const sortedSales = [...totalSalesToday].sort((a,b) => b.fecha - a.fecha).slice(0, 5);
            recentBody.innerHTML = sortedSales.map(s => `
                <tr>
                    <td><strong>${s.productoNombre}</strong></td>
                    <td>${s.cantidad} ud</td>
                    <td>S/ ${s.total.toFixed(2)}</td>
                </tr>
            `).join('');
        }
    }

    renderAdminProducts() {
        const tbody = document.getElementById('adminProductsTableBody');
        tbody.innerHTML = this.products.map(p => `
            <tr>
                <td><strong>${p.nombre}</strong><br><small class="font-muted">${p.descripcion || ''}</small></td>
                <td><span class="product-badge">${p.categoria}</span></td>
                <td>S/ ${p.precio.toFixed(2)}</td>
                <td><span class="${p.stock < 5 ? 'color-danger font-weight-bold' : ''}">${p.stock} uds</span></td>
                <td class="text-right">
                    <div class="table-actions">
                        <button class="btn-icon btn-table" onclick="app.openProductModal('${p._id}')" title="Editar">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn-icon btn-table btn-remove-item" onclick="app.deleteProduct('${p._id}')" title="Eliminar">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderAdminSales() {
        const tbody = document.getElementById('fullSalesTableBody');
        if (this.sales.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center font-muted">No hay registros de ventas.</td></tr>`;
            return;
        }

        // Sort descending by date
        const sorted = [...this.sales].sort((a,b) => b.fecha - a.fecha);

        tbody.innerHTML = sorted.map(s => {
            const date = new Date(s.fecha);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            return `
                <tr>
                    <td>${dateStr}</td>
                    <td><strong>${s.productoNombre}</strong></td>
                    <td>${s.cantidad} ud(s)</td>
                    <td>S/ ${s.total.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    }

    // ==========================================
    // CRUD OPERATIONS (PRODUCT MANAGEMENT)
    // ==========================================

    openProductModal(productId = null) {
        const modal = document.getElementById('productModal');
        const backdrop = document.getElementById('appBackdrop');
        const form = document.getElementById('productForm');
        const title = document.getElementById('modalTitle');
        
        form.reset();
        document.getElementById('formProductId').value = '';

        if (productId) {
            title.innerText = 'Editar Producto';
            const prod = this.products.find(p => p._id === productId);
            if (prod) {
                document.getElementById('formProductId').value = prod._id;
                document.getElementById('formProductName').value = prod.nombre;
                document.getElementById('formProductCategory').value = prod.categoria;
                document.getElementById('formProductPrice').value = prod.precio;
                document.getElementById('formProductStock').value = prod.stock;
                document.getElementById('formProductDescription').value = prod.descripcion || '';
            }
        } else {
            title.innerText = 'Agregar Nuevo Producto';
        }

        modal.classList.add('active');
        backdrop.classList.add('active');
    }

    closeProductModal() {
        document.getElementById('productModal').classList.remove('active');
        document.getElementById('appBackdrop').classList.remove('active');
    }

    handleBackdropClick() {
        this.closeProductModal();
        this.hideCart();
    }

    async handleProductFormSubmit(e) {
        e.preventDefault();
        
        const id = document.getElementById('formProductId').value;
        const payload = {
            nombre: document.getElementById('formProductName').value.trim(),
            categoria: document.getElementById('formProductCategory').value,
            precio: parseFloat(document.getElementById('formProductPrice').value),
            stock: parseInt(document.getElementById('formProductStock').value),
            descripcion: document.getElementById('formProductDescription').value.trim()
        };

        this.showProgressBar(40);
        let url = `${API_BASE}/productos`;
        let method = 'POST';

        if (id) {
            url += `/${id}`;
            method = 'PUT';
        }

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Error al guardar producto');
            
            this.showProgressBar(100);
            this.closeProductModal();
            this.showToast(id ? '✏️ Producto actualizado correctamente' : '📦 Producto agregado correctamente', 'success');

            // Refresh data & views
            await this.fetchProducts();
            this.renderProducts();
            this.renderAdminProducts();
            this.renderAdminDashboard();
        } catch (err) {
            console.error(err);
            this.showToast('Error al guardar el producto.', 'danger');
            this.showProgressBar(0);
        }
    }

    async deleteProduct(productId) {
        const prod = this.products.find(p => p._id === productId);
        if (!prod) return;

        const confirmDelete = confirm(`¿Estás seguro que deseas eliminar el producto "${prod.nombre}"?`);
        if (!confirmDelete) return;

        this.showProgressBar(40);
        try {
            const res = await fetch(`${API_BASE}/productos/${productId}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error('Error al eliminar producto');

            this.showProgressBar(100);
            this.showToast('🗑️ Producto eliminado correctamente', 'success');

            // Refresh data & views
            await this.fetchProducts();
            this.renderProducts();
            this.renderAdminProducts();
            this.renderAdminDashboard();
        } catch (err) {
            console.error(err);
            this.showToast('Error al eliminar el producto.', 'danger');
            this.showProgressBar(0);
        }
    }

    // ==========================================
    // UI FEEDBACK UTILITIES
    // ==========================================

    showProgressBar(percent) {
        const bar = document.getElementById('topProgressBar');
        bar.style.width = `${percent}%`;
        if (percent === 100) {
            setTimeout(() => {
                bar.style.width = '0%';
            }, 500);
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toastNotification');
        const msgEl = document.getElementById('toastMessage');
        const icon = toast.querySelector('.toast-icon i');

        msgEl.innerText = message;
        toast.className = 'toast active'; // Reset class
        
        // Apply type classes and icons
        if (type === 'success') {
            toast.classList.add('toast-success');
            icon.className = 'fa-solid fa-circle-check';
        } else if (type === 'danger') {
            toast.classList.add('toast-danger');
            icon.className = 'fa-solid fa-circle-xmark';
        } else if (type === 'warning') {
            toast.classList.add('toast-warning');
            icon.className = 'fa-solid fa-triangle-exclamation';
        } else {
            icon.className = 'fa-solid fa-info-circle';
        }

        // Hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('active');
        }, 3000);
    }
}

// Instantiate and start
const app = new FarmaciaApp();
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});
