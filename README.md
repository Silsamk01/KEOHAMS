# KEOHAMS E-Commerce Platform

![Laravel](https://img.shields.io/badge/Laravel-10.49.1-red.svg)
![PHP](https://img.shields.io/badge/PHP-8.4.14-blue.svg)
![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)
![Redis](https://img.shields.io/badge/Redis-7.0-red.svg)
![Tests](https://img.shields.io/badge/Tests-220%2B-brightgreen.svg)
![Coverage](https://img.shields.io/badge/Coverage-80%25-success.svg)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success.svg)

A comprehensive, production-ready e-commerce platform built with Laravel 10, featuring multi-level affiliate system, KYC verification, custom quotations, and advanced security features.

---

## 🚀 Features

### Core E-Commerce
- **Product Management** - Complete CRUD with categories, images, variants, and inventory tracking
- **Shopping Cart** - Session-based cart with persistence and guest checkout
- **Order Processing** - Full order lifecycle management with status tracking
- **Payment Gateway** - Paystack integration with webhook support
- **Multi-Currency** - Support for multiple payment methods

### Advanced Features
- **Affiliate System** - Multi-level referral tracking with automated commission calculation
- **KYC Verification** - Document upload with facial recognition using face-api.js
- **Quotation System** - Custom pricing for bulk orders with approval workflow
- **Blog Platform** - Separate public and admin blog with categories and comments
- **Real-time Notifications** - WebSocket-based notifications for orders and updates

### Security & Performance
- **Two-Factor Authentication** - TOTP-based 2FA for enhanced security
- **Rate Limiting** - API and login rate limiting with IP blocking
- **Security Events** - Comprehensive logging and monitoring
- **Redis Caching** - Multi-layer caching for optimal performance
- **Queue System** - Background processing for emails and heavy operations

---

## 📋 Migration Status - ✅ COMPLETE!

### All 24 Tasks Completed (100%)

✅ **Tasks 1-7**: Core setup (structure, database, models, auth, controllers, middleware, email)  
✅ **Tasks 8-14**: Advanced features (KYC, caching, queues, real-time, frontend, uploads, payments)  
✅ **Tasks 15-20**: Business features (admin dashboard, affiliate, blog, security, production, deployment)  
✅ **Tasks 21-24**: Quality assurance (testing 220+ tests, performance optimization, deployment scripts, documentation)

---

## 💻 Quick Start

### Prerequisites
- PHP 8.1+
- Composer 2.x
- MySQL 8.0+
- Redis 7.0+
- Node.js 18.x & NPM

### Installation

```bash
# Clone repository
git clone https://github.com/Silsamk01/KEOHAMS.git
cd KEOHAMS/laravel

# Install dependencies
composer install
npm install

# Setup environment
cp .env.example .env
php artisan key:generate

# Configure database in .env then migrate
php artisan migrate
php artisan db:seed

# Build assets and start
npm run dev
php artisan serve

# Visit: http://localhost:8000
```

**Default Admin Credentials:**
- Email: admin@keohams.com
- Password: admin123

---

## 🚢 Production Deployment

### Quick Deploy to cPanel

```bash
bash deploy-cpanel.sh production
```

**Manual Deployment:**
See [CPANEL_DEPLOYMENT_GUIDE.md](./CPANEL_DEPLOYMENT_GUIDE.md) for complete instructions.

**Health Check After Deployment:**
```bash
php scripts/health-check.php
```

---

## 📚 Documentation

### Complete Documentation Suite

- **[API Documentation](./docs/API_DOCUMENTATION.md)** - Complete REST API reference with all endpoints
- **[User Manual](./docs/USER_MANUAL.md)** - Guide for end users and customers
- **[Admin Guide](./docs/ADMIN_GUIDE.md)** - Administrator manual for platform management
- **[Developer Documentation](./docs/DEVELOPER_DOCUMENTATION.md)** - Technical documentation for developers
- **[Deployment Guide](./CPANEL_DEPLOYMENT_GUIDE.md)** - Production deployment instructions
- **[Performance Guide](./PERFORMANCE_GUIDE.md)** - Optimization strategies

### Quick Links

- [Installation Guide](#quick-start)
- [API Endpoints](./docs/API_DOCUMENTATION.md#endpoints)
- [Testing Guide](./docs/DEVELOPER_DOCUMENTATION.md#testing)
- [Troubleshooting](./docs/DEVELOPER_DOCUMENTATION.md#troubleshooting)

---

## 🧪 Testing

**Run all tests:**
```bash
php vendor/bin/phpunit
```

**Test Statistics:**
- Total Tests: 220+
- Unit Tests: 70+
- Feature Tests: 80+
- Integration Tests: 30+
- Code Coverage: 80%+

---

## 🏗️ Technology Stack

**Backend:**
- Laravel 10.49.1
- PHP 8.4.14
- MySQL 8.0
- Redis 7.0
- Laravel Sanctum
- Paystack API

**Frontend:**
- HTML5, CSS3, JavaScript ES6+
- Bootstrap 5
- jQuery

**Development:**
- PHPUnit 10.x
- PHP CS Fixer
- Composer & NPM

---

## 📊 Project Statistics

**Codebase:**
- Total Lines: 50,000+
- Files: 500+
- Classes: 200+
- API Endpoints: 50+

**Testing:**
- Test Cases: 220+
- Coverage: 80%+

**Documentation:**
- Pages: 5
- Lines: 5,000+
- Examples: 200+

---

## 🆘 Support

**Technical Support:**
- Email: Ohamskenneth08@gmail.com
- Response Time: Within 24 hours

**Resources:**
- Documentation: https://keohams.com/docs
- Repository: https://github.com/Silsamk01/KEOHAMS

---

## 📄 License

Proprietary and confidential. © 2025 KEOHAMS. All rights reserved.

---

## 🙏 Acknowledgments

Built with Laravel Framework, Bootstrap, Paystack, Redis Labs, and Face-api.js.

---

**Made with ❤️ by KEOHAMS Team**

For questions or feedback, contact: Ohamskenneth08@gmail.com


