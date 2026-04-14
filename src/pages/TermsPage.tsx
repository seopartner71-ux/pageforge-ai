import { Link } from 'react-router-dom';
import { useLang } from '@/contexts/LangContext';
import { LangToggle } from '@/components/LangToggle';
import { Zap, ArrowLeft } from 'lucide-react';

export default function TermsPage() {
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
          {isRu ? 'Публичная оферта' : 'Terms of Service'}
        </h1>
        <div className="prose prose-invert prose-sm max-w-none space-y-4 text-muted-foreground">
          {isRu ? (
            <>
              <p>Настоящий документ является публичной офертой ИП Синицын Владимир Николаевич и определяет условия использования сервиса PageForge AI.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">1. Предмет оферты</h2>
              <p>Исполнитель предоставляет Заказчику доступ к онлайн-сервису SEO-аудита PageForge AI на условиях выбранного тарифного плана.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">2. Условия использования</h2>
              <p>Пользователь обязуется использовать сервис в соответствии с действующим законодательством и не нарушать права третьих лиц.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">3. Оплата</h2>
              <p>Оплата услуг производится в соответствии с выбранным тарифным планом. Возврат средств осуществляется в соответствии с законодательством РФ.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">4. Ограничение ответственности</h2>
              <p>Сервис предоставляется «как есть». Исполнитель не гарантирует достижение конкретных результатов SEO-продвижения.</p>
            </>
          ) : (
            <>
              <p>This document constitutes the Terms of Service for PageForge AI and defines the conditions of use.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">1. Subject</h2>
              <p>The Provider grants the User access to the PageForge AI online SEO audit service under the selected pricing plan.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">2. Terms of Use</h2>
              <p>The User agrees to use the service in accordance with applicable law and not to violate the rights of third parties.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">3. Payment</h2>
              <p>Payment for services is made in accordance with the selected pricing plan. Refunds are processed in accordance with applicable law.</p>
              <h2 className="text-foreground text-lg font-semibold mt-8">4. Limitation of Liability</h2>
              <p>The service is provided "as is." The Provider does not guarantee specific SEO results.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
