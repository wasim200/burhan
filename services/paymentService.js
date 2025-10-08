let stripeInstance = null;
function getStripe() {
  if (!stripeInstance) {
    const Stripe = require('stripe');
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('Stripe is not configured. Missing STRIPE_SECRET_KEY in environment.');
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}
const User = require('../models/User');
const Subscription = require('../models/Subscription');

class PaymentService {
  // إنشاء عميل في Stripe
  async createCustomer(userData) {
    try {
      const customer = await getStripe().customers.create({
        email: userData.email,
        name: userData.username,
        metadata: {
          userId: userData._id.toString()
        }
      });
      
      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw new Error('Failed to create customer');
    }
  }

  // إنشاء جلسة دفع
  async createCheckoutSession(userId, priceId, successUrl, cancelUrl) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // إنشاء عميل إذا لم يكن موجوداً
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await this.createCustomer(user);
        customerId = customer.id;
        user.stripeCustomerId = customerId;
        await user.save();
      }

      const session = await getStripe().checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: userId.toString()
        }
      });

      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  // معالجة webhook من Stripe
  async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object);
          break;
        
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  // معالجة اكتمال عملية الدفع
  async handleCheckoutCompleted(session) {
    try {
      const userId = session.metadata.userId;
      const subscription = await getStripe().subscriptions.retrieve(session.subscription);
      
      // تحديث حالة المستخدم
      await User.findByIdAndUpdate(userId, {
        'subscription.status': 'active',
        'subscription.plan': this.getPlanFromPriceId(subscription.items.data[0].price.id),
        'subscription.startDate': new Date(subscription.current_period_start * 1000),
        'subscription.endDate': new Date(subscription.current_period_end * 1000),
        'subscription.paymentId': session.id
      });

      // حفظ تفاصيل الاشتراك
      await Subscription.create({
        userId: userId,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        plan: this.getPlanFromPriceId(subscription.items.data[0].price.id),
        status: 'active',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      });

    } catch (error) {
      console.error('Error handling checkout completion:', error);
      throw error;
    }
  }

  // معالجة تحديث الاشتراك
  async handleSubscriptionUpdated(subscription) {
    try {
      await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: subscription.id },
        {
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        }
      );
    } catch (error) {
      console.error('Error handling subscription update:', error);
      throw error;
    }
  }

  // معالجة إلغاء الاشتراك
  async handleSubscriptionDeleted(subscription) {
    try {
      const sub = await Subscription.findOne({ stripeSubscriptionId: subscription.id });
      if (sub) {
        await User.findByIdAndUpdate(sub.userId, {
          'subscription.status': 'inactive'
        });
        
        await Subscription.findByIdAndUpdate(sub._id, {
          status: 'canceled'
        });
      }
    } catch (error) {
      console.error('Error handling subscription deletion:', error);
      throw error;
    }
  }

  // معالجة فشل الدفع
  async handlePaymentFailed(invoice) {
    try {
      const subscription = await Subscription.findOne({ stripeCustomerId: invoice.customer });
      if (subscription) {
        await User.findByIdAndUpdate(subscription.userId, {
          'subscription.status': 'past_due'
        });
        
        await Subscription.findByIdAndUpdate(subscription._id, {
          status: 'past_due'
        });
      }
    } catch (error) {
      console.error('Error handling payment failure:', error);
      throw error;
    }
  }

  // معالجة نجاح الدفع
  async handlePaymentSucceeded(invoice) {
    try {
      const subscription = await Subscription.findOne({ stripeCustomerId: invoice.customer });
      if (subscription && subscription.status === 'past_due') {
        await User.findByIdAndUpdate(subscription.userId, {
          'subscription.status': 'active'
        });
        
        await Subscription.findByIdAndUpdate(subscription._id, {
          status: 'active'
        });
      }
    } catch (error) {
      console.error('Error handling payment success:', error);
      throw error;
    }
  }

  // الحصول على الخطة من معرف السعر
  getPlanFromPriceId(priceId) {
    const prices = {
      [process.env.STRIPE_BASIC_PRICE]: 'basic',
      [process.env.STRIPE_PREMIUM_PRICE]: 'premium',
      [process.env.STRIPE_ENTERPRISE_PRICE]: 'enterprise'
    };
    
    return prices[priceId] || 'basic';
  }

  // إلغاء الاشتراك
  async cancelSubscription(subscriptionId) {
    try {
      const subscription = await getStripe().subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });

      await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: subscriptionId },
        { cancelAtPeriodEnd: true }
      );

      return subscription;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  // استعادة الاشتراك الملغى
  async reactivateSubscription(subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false
      });

      await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: subscriptionId },
        { cancelAtPeriodEnd: false }
      );

      return subscription;
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      throw new Error('Failed to reactivate subscription');
    }
  }

  // الحصول على فاتورة
  async getInvoice(invoiceId) {
    try {
      return await getStripe().invoices.retrieve(invoiceId);
    } catch (error) {
      console.error('Error retrieving invoice:', error);
      throw new Error('Failed to retrieve invoice');
    }
  }

  // الحصول على تاريخ الفواتير
  async getInvoices(customerId, limit = 10) {
    try {
      return await getStripe().invoices.list({
        customer: customerId,
        limit: limit
      });
    } catch (error) {
      console.error('Error retrieving invoices:', error);
      throw new Error('Failed to retrieve invoices');
    }
  }
}

module.exports = new PaymentService();