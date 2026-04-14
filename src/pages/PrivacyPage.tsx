import { Link } from 'react-router-dom';
import { useLang } from '@/contexts/LangContext';
import { LangToggle } from '@/components/LangToggle';
import { Zap, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  const { lang } = useLang();
  const isRu = lang === 'ru';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/20 bg-background/70 backdrop-blur-2xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg btn-gradient flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold gradient-text">PageForge AI</span>
          </Link>
          <LangToggle />
        </div>
      </header>
      <div className="container max-w-2xl py-16">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-3.5 h-3.5" />
          {isRu ? 'На главную' : 'Back to home'}
        </Link>
        <h1 className="text-3xl font-bold mb-8 text-foreground">
          {isRu ? 'Политика конфиденциальности' : 'Privacy Policy'}
        </h1>
        <div className="prose prose-invert prose-sm max-w-none space-y-4 text-muted-foreground">
          {isRu ? (
            <>
              <p>Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей сервиса PageForge AI.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">1. Сбор информации</h2>
              <p>Мы собираем информацию, которую вы предоставляете при регистрации: email-адрес, имя. Также автоматически собираются данные об использовании сервиса.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">2. Использование информации</h2>
              <p>Собранная информация используется для предоставления услуг, улучшения сервиса, отправки уведомлений и обеспечения безопасности.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">3. Защита данных</h2>
              <p>Мы принимаем все необходимые меры для защиты ваших персональных данных от несанкционированного доступа, изменения, раскрытия или уничтожения.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">4. Контакты</h2>
              <p>По вопросам обработки персональных данных обращайтесь по email: support@pageforge.ai</p>
            </>
          ) : (
            <>
              <p>This Privacy Policy describes how PageForge AI collects, uses, and protects your personal information.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">1. Information Collection</h2>
              <p>We collect information you provide during registration: email address, name. Usage data is also collected automatically.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">2. Use of Information</h2>
              <p>Collected information is used to provide services, improve the platform, send notifications, and ensure security.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">3. Data Protection</h2>
              <p>We take all necessary measures to protect your personal data from unauthorized access, modification, disclosure, or destruction.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">4. Contact</h2>
              <p>For questions about data processing, contact us at: support@pageforge.ai</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
