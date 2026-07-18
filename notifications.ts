import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Configure Brevo SMTP transporter
const mailTransporter = nodemailer.createTransport({
  host: process.env.BREVO_EMAIL || 'smtp-relay.brevo.com',
  port: parseInt(process.env.BREVO_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.BREVO_LOGIN,
    pass: process.env.BREVO_KEY,
  },
});

// Helper to send WhatsApp message via Fonnte
export async function sendWhatsAppNotification(phone: string, name: string) {
  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    console.log('FONNTE_TOKEN is not configured in .env. Skipping WhatsApp notification.');
    return;
  }
  
  // Clean/normalize phone number (Fonnte expects target with digits only)
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  
  const welcomeMessage = `Halo ${name}! 🐝 Selamat bergabung di BeeChat (Sarang Lebah Terbuka kami)! Akun Anda telah berhasil terdaftar. Ayo mulai terbang dan sebarkan nektar kebaikan dengan mengobrol bersama koloni lebah pekerja lainnya! 🍯✨`;

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target: cleanPhone,
        message: welcomeMessage
      })
    });
    const resData = (await response.json()) as any;
    if (resData.status) {
      console.log(`WhatsApp notification successfully queued to ${cleanPhone}`);
    } else {
      console.error(`Fonnte API returned error:`, resData.reason || resData);
    }
  } catch (err) {
    console.error('Failed to send WhatsApp notification:', err);
  }
}

// Helper to send Email notification via Brevo SMTP
export async function sendEmailNotification(email: string, name: string) {
  const login = process.env.BREVO_LOGIN;
  const key = process.env.BREVO_KEY;
  if (!login || !key) {
    console.log('Brevo credentials are not configured in .env. Skipping Email notification.');
    return;
  }

  const welcomeHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #fcfbfa;">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 40px;">🐝</span>
        <h1 style="color: #d97706; margin: 10px 0 0 0; font-size: 24px;">Selamat Datang di BeeChat!</h1>
      </div>
      <p style="color: #333333; font-size: 16px; line-height: 1.5;">Halo <strong>${name}</strong>,</p>
      <p style="color: #333333; font-size: 16px; line-height: 1.5;">
        Akun Anda telah berhasil terdaftar di <strong>BeeChat (Sarang Lebah Terbuka kami)</strong>! 🍯
      </p>
      <p style="color: #333333; font-size: 16px; line-height: 1.5;">
        Ayo mulai masuk ke aplikasi, buat sarang obrolan baru, dan mulailah terbang bersama seluruh koloni lebah pekerja lainnya.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="http://localhost:3000" style="background-color: #fbbf24; color: #171717; padding: 12px 24px; font-weight: bold; text-decoration: none; border-radius: 8px; font-size: 16px; display: inline-block;">
          Masuk ke Sarang Lebah 🐝
        </a>
      </div>
      <p style="color: #666666; font-size: 14px; border-top: 1px solid #eeeeee; padding-top: 15px;">
        Pesan otomatis dari BeeChat App v${process.env.APP_VERSION || '1.0'} • Tetap manis dan produktif!
      </p>
    </div>
  `;

  try {
    await mailTransporter.sendMail({
      from: `"${process.env.APP_NAME || 'BeeChat'}" <no-reply@beechat.com>`,
      to: email,
      subject: `Selamat Bergabung di BeeChat, ${name}! 🐝`,
      html: welcomeHtml,
    });
    console.log(`Email notification successfully sent to ${email}`);
  } catch (err) {
    console.error('Failed to send Email notification:', err);
  }
}
