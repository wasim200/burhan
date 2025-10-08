const BankTransfer = require('../models/BankTransfer');
const Subscription = require('../models/Subscription');
const User = require('../models/User');

class BankTransferService {
  // إنشاء طلب تحويل بنكي جديد
  async createBankTransfer(userId, transferData, receiptImagePath) {
    try {
      // تحديد سعر الباقة
      const planPrices = {
        'basic': 10,
        'premium': 25,
        'enterprise': 100
      };

      const transfer = new BankTransfer({
        userId: userId,
        plan: transferData.plan,
        amount: planPrices[transferData.plan],
        bankName: transferData.bankName,
        accountNumber: transferData.accountNumber,
        transferDate: transferData.transferDate,
        receiptImage: receiptImagePath,
        status: 'pending'
      });

      await transfer.save();

      // إنشاء اشتراك معلق
      const subscription = new Subscription({
        userId: userId,
        plan: transferData.plan,
        status: 'pending',
        bankTransferId: transfer._id,
        paymentMethod: 'bank_transfer'
      });

      await subscription.save();

      // تحديث حالة المستخدم
      await User.findByIdAndUpdate(userId, {
        'subscription.plan': transferData.plan,
        'subscription.status': 'pending',
        'subscription.paymentId': transfer._id.toString()
      });

      return { transfer, subscription };
    } catch (error) {
      console.error('Error creating bank transfer:', error);
      throw new Error('Failed to create bank transfer request');
    }
  }

  // الحصول على جميع طلبات التحويل
  async getBankTransfers(status = null) {
    try {
      let query = {};
      if (status) {
        query.status = status;
      }

      return await BankTransfer.find(query)
        .populate('userId', 'username email')
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error fetching bank transfers:', error);
      throw new Error('Failed to fetch bank transfers');
    }
  }

  // الحصول على طلبات التحويل الخاصة بمستخدم معين
  async getUserBankTransfers(userId) {
    try {
      return await BankTransfer.find({ userId })
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error fetching user bank transfers:', error);
      throw new Error('Failed to fetch user bank transfers');
    }
  }

  // الموافقة على تحويل بنكي
  async approveBankTransfer(transferId, adminNotes = '') {
    try {
      const transfer = await BankTransfer.findById(transferId);
      if (!transfer) {
        throw new Error('Bank transfer not found');
      }

      // تحديث حالة التحويل
      transfer.status = 'approved';
      transfer.adminNotes = adminNotes;
      await transfer.save();

      // تحديث الاشتراك
      const subscription = await Subscription.findOne({ bankTransferId: transferId });
      if (subscription) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1); // اشتراك لمدة شهر

        subscription.status = 'active';
        subscription.startDate = startDate;
        subscription.endDate = endDate;
        await subscription.save();

        // تحديث حالة المستخدم
        await User.findByIdAndUpdate(transfer.userId, {
          'subscription.status': 'active',
          'subscription.startDate': startDate,
          'subscription.endDate': endDate
        });
      }

      return { transfer, subscription };
    } catch (error) {
      console.error('Error approving bank transfer:', error);
      throw new Error('Failed to approve bank transfer');
    }
  }

  // رفض تحويل بنكي
  async rejectBankTransfer(transferId, adminNotes) {
    try {
      const transfer = await BankTransfer.findById(transferId);
      if (!transfer) {
        throw new Error('Bank transfer not found');
      }

      // تحديث حالة التحويل
      transfer.status = 'rejected';
      transfer.adminNotes = adminNotes;
      await transfer.save();

      // تحديث الاشتراك
      const subscription = await Subscription.findOne({ bankTransferId: transferId });
      if (subscription) {
        subscription.status = 'canceled';
        await subscription.save();
      }

      // تحديث حالة المستخدم
      await User.findByIdAndUpdate(transfer.userId, {
        'subscription.status': 'inactive'
      });

      return transfer;
    } catch (error) {
      console.error('Error rejecting bank transfer:', error);
      throw new Error('Failed to reject bank transfer');
    }
  }

  // الحصول على إحصائيات التحويلات
  async getBankTransferStats() {
    try {
      const total = await BankTransfer.countDocuments();
      const pending = await BankTransfer.countDocuments({ status: 'pending' });
      const approved = await BankTransfer.countDocuments({ status: 'approved' });
      const rejected = await BankTransfer.countDocuments({ status: 'rejected' });

      return { total, pending, approved, rejected };
    } catch (error) {
      console.error('Error fetching bank transfer stats:', error);
      throw new Error('Failed to fetch bank transfer statistics');
    }
  }
}

module.exports = new BankTransferService();