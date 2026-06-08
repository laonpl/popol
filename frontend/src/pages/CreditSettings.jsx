import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CreditCard, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useCreditStore from '../stores/creditStore';

const METHOD_ICON = { card: 'CARD', kakaopay: 'KAKAO', tosspay: 'TOSS' };
const SUPPORT_MESSAGE = '인스타그램 fitpoly_으로 DM 혹은 gudrbs14@naver.com로 문의주세요.';

function formatCredits(value) {
  return Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 });
}

function formatDate(value) {
  const date = value?._seconds || value?.seconds ? new Date((value._seconds || value.seconds) * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('ko-KR');
}

function loadPortOne() {
  if (window.PortOne) return Promise.resolve(window.PortOne);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-portone-sdk]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.PortOne), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.portone.io/v2/browser-sdk.js';
    script.dataset.portoneSdk = 'true';
    script.onload = () => resolve(window.PortOne);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function CreditSettings() {
  const { wallet, loading, loadWallet } = useCreditStore();
  const [options, setOptions] = useState({ packages: [], paymentMethods: [] });
  const [transactions, setTransactions] = useState([]);
  const [packageId, setPackageId] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const remainingCredits = Math.max(0, Number(wallet?.balance || 0));
  const isCreditDepleted = !loading && remainingCredits <= 0;

  const load = async () => {
    try {
      const [, optionRes, transactionRes] = await Promise.all([
        loadWallet({ silent: true }),
        api.get('/billing/options'),
        api.get('/billing/transactions'),
      ]);
      setOptions(optionRes.data);
      setTransactions(transactionRes.data.transactions || []);
    } catch {
      toast.error('크레딧 정보를 불러오지 못했습니다.');
    }
  };

  useEffect(() => {
    load();
    const paymentId = new URLSearchParams(window.location.search).get('paymentId');
    if (paymentId) {
      api.post('/billing/complete', { orderId: paymentId, paymentId })
        .then(() => {
          toast.success('크레딧 충전이 완료됐습니다.');
          load();
          window.history.replaceState({}, '', window.location.pathname);
        })
        .catch(error => toast.error(error.response?.data?.error || '결제 승인 확인에 실패했습니다.'));
    }
  }, []);

  const checkout = () => {
    toast(SUPPORT_MESSAGE, { duration: 8000 });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-primary-600 mb-1">설정</p>
          <h1 className="text-2xl font-bold text-bluewood-800">크레딧 관리</h1>
          <p className="text-sm text-bluewood-400 mt-1">AI 기능과 모델 사용량에 따라 크레딧이 차감됩니다.</p>
        </div>
        <Link to="/app/profile-setup" className="px-4 py-2 text-sm font-semibold text-bluewood-500 bg-white border border-surface-200 rounded-lg hover:border-primary-300">
          내 정보 관리
        </Link>
      </div>

      <section className="bg-bluewood-800 text-white rounded-2xl p-6 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-white/60 mb-2">사용 가능한 크레딧</p>
          <p className="text-4xl font-bold tabular-nums">{loading ? '-' : formatCredits(remainingCredits)} <span className="text-lg text-white/70">C</span></p>
        </div>
        <button onClick={load} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20" title="새로고침"><RefreshCw size={18} /></button>
      </section>

      {isCreditDepleted && (
        <div className="mb-6 rounded-2xl border border-primary-100 bg-primary-50 px-5 py-4 text-sm font-medium text-primary-700">
          {SUPPORT_MESSAGE}
        </div>
      )}

      <section className="bg-white rounded-2xl border border-surface-200 p-6 mb-6">
        <h2 className="font-bold text-bluewood-800 mb-4">충전할 크레딧</h2>
        <div className="grid grid-cols-3 gap-3">
          {options.packages.map(item => (
            <button key={item.id} onClick={() => setPackageId(item.id)}
              className={`relative text-left p-4 rounded-xl border-2 transition-colors ${packageId === item.id ? 'border-primary-500 bg-primary-50' : 'border-surface-100 hover:border-primary-200'}`}>
              {packageId === item.id && <Check size={15} className="absolute right-3 top-3 text-primary-600" />}
              <p className="text-xs text-primary-600 font-semibold mb-2">{item.label}</p>
              <p className="text-xl font-bold text-bluewood-800">{item.credits.toLocaleString()} C</p>
              <p className="text-sm text-bluewood-400 mt-1">{item.price.toLocaleString()}원</p>
            </button>
          ))}
        </div>

        <h2 className="font-bold text-bluewood-800 mt-7 mb-4">결제 수단</h2>
        <div className="grid grid-cols-3 gap-3">
          {options.paymentMethods.map(method => (
            <button key={method.id} onClick={() => setPaymentMethod(method.id)}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${paymentMethod === method.id ? 'border-primary-500 bg-primary-50' : 'border-surface-100 hover:border-primary-200'}`}>
              <CreditCard size={18} className="text-bluewood-500" />
              <div className="text-left">
                <p className="text-[10px] font-bold tracking-wide text-bluewood-300">{METHOD_ICON[method.id]}</p>
                <p className="text-sm font-semibold text-bluewood-700">{method.label}</p>
              </div>
            </button>
          ))}
        </div>

        <button onClick={checkout}
          className="w-full mt-6 py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold">
          선택한 수단으로 결제하기
        </button>
      </section>

      <section className="bg-white rounded-2xl border border-surface-200 p-6">
        <h2 className="font-bold text-bluewood-800 mb-4">최근 크레딧 내역</h2>
        <div className="divide-y divide-surface-100">
          {transactions.length === 0 && <p className="text-sm text-bluewood-300 py-6 text-center">아직 크레딧 내역이 없습니다.</p>}
          {transactions.map(item => (
            <div key={item.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium text-bluewood-700">{item.description}</p>
                <p className="text-xs text-bluewood-300 mt-1">{formatDate(item.createdAt)}</p>
              </div>
              <p className={`font-bold tabular-nums ${item.amount >= 0 ? 'text-primary-600' : 'text-bluewood-600'}`}>
                {item.amount >= 0 ? '+' : ''}{formatCredits(item.amount)} C
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
