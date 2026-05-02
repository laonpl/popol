# Design System Guidelines (테스트 템플릿)

이 문서는 제공된 디자인 시스템 명세 정보를 바탕으로 작성된 스타일 가이드입니다. 개발자가 즉시 사용할 수 있도록 토큰 명명 규칙(Naming Convention)과 수치, 색상 코드를 체계적으로 정리했습니다.

---

## 1. Foundation (Basic Tokens)

### 🎨 Color Palette

| Category | Role | Hex Code | Naming Convention |
| :--- | :--- | :--- | :--- |
| **Primary** | Main Brand Color | `#2962FF` | `color-primary-500` |
| **Semantic** | Success | `#00C853` | `color-success-500` |
| **Semantic** | Warning | `#FFD600` | `color-warning-500` |
| **Semantic** | Danger | `#D50000` | `color-danger-500` |
| **Semantic** | Info | `#00B0FF` | `color-info-500` |
| **Neutral** | Gray 50 (Background) | `#FAFAFA` | `color-gray-50` |
| **Neutral** | Gray 100 (Surface) | `#F5F5F5` | `color-gray-100` |
| **Neutral** | Gray 200 (Divider) | `#EEEEEE` | `color-gray-200` |
| **Neutral** | Gray 300 (Border) | `#E0E0E0` | `color-gray-300` |
| **Neutral** | Gray 400 (Icon) | `#BDBDBD` | `color-gray-400` |
| **Neutral** | Gray 500 (Text Muted) | `#9E9E9E` | `color-gray-500` |
| **Neutral** | Gray 600 (Text Sub) | `#757575` | `color-gray-600` |
| **Neutral** | Gray 700 (Text Base) | `#616161` | `color-gray-700` |
| **Neutral** | Gray 800 (Text Strong)| `#424242` | `color-gray-800` |
| **Neutral** | Gray 900 (Heading) | `#212121` | `color-gray-900` |

### 🔠 Typography

폰트는 기본적으로 `Pretendard` 또는 `Inter`를 사용합니다.

| Level | Font Size | Font Weight | Line Height | Naming Convention |
| :--- | :--- | :--- | :--- | :--- |
| **H1** | 40px (2.5rem) | Bold (700) | 1.2 | `text-h1` |
| **H2** | 32px (2.0rem) | Bold (700) | 1.3 | `text-h2` |
| **H3** | 24px (1.5rem) | SemiBold (600) | 1.4 | `text-h3` |
| **H4** | 20px (1.25rem)| SemiBold (600) | 1.4 | `text-h4` |
| **Body 1** | 16px (1.0rem) | Regular (400) / Medium (500) | 1.5 | `text-body-1` |
| **Body 2** | 14px (0.875rem)| Regular (400) | 1.5 | `text-body-2` |
| **Caption**| 12px (0.75rem) | Regular (400) | 1.4 | `text-caption` |

### 📏 Spacing (8-point grid system)

| Level | Value | Naming Convention |
| :--- | :--- | :--- |
| **Scale 1** | 4px | `spacing-1` |
| **Scale 2** | 8px | `spacing-2` |
| **Scale 3** | 12px | `spacing-3` |
| **Scale 4** | 16px | `spacing-4` |
| **Scale 5** | 24px | `spacing-5` |
| **Scale 6** | 32px | `spacing-6` |
| **Scale 7** | 48px | `spacing-7` |
| **Scale 8** | 64px | `spacing-8` |

### 📐 Elevation (Shadow) & Border Radius

**Elevation (Shadow)**
| Level | CSS Box-Shadow | Naming Convention |
| :--- | :--- | :--- |
| **Level 1** | `0 1px 2px rgba(0,0,0,0.05)` | `shadow-1` / `shadow-sm` |
| **Level 2** | `0 4px 6px -1px rgba(0,0,0,0.1)` | `shadow-2` / `shadow-md` |
| **Level 3** | `0 10px 15px -3px rgba(0,0,0,0.1)` | `shadow-3` / `shadow-lg` |
| **Level 4** | `0 20px 25px -5px rgba(0,0,0,0.1)` | `shadow-4` / `shadow-xl` |
| **Level 5** | `0 25px 50px -12px rgba(0,0,0,0.25)` | `shadow-5` / `shadow-2xl` |

**Border Radius**
| Level | Value | Naming Convention |
| :--- | :--- | :--- |
| **None** | 0px | `rounded-none` |
| **SM** | 4px | `rounded-sm` |
| **MD** | 8px | `rounded-md` |
| **LG** | 12px | `rounded-lg` |
| **XL** | 16px | `rounded-xl` |
| **Full** | 9999px | `rounded-full` |

### 🎯 Icons
아이콘은 **Line Icon 세트(예: Lucide React, Feather Icons)**를 사용하며, 기본 `stroke-width`는 `2px`로 정의합니다.

---

## 2. Components 1 (Buttons & Forms Matrix)

### 🔘 Button Matrix

**Button Sizes**
| Size | Height | Padding (X) | Font Size | Naming Convention |
| :--- | :--- | :--- | :--- | :--- |
| **XS** | 24px | 8px | 12px | `btn-size-xs` |
| **S** | 32px | 12px | 14px | `btn-size-s` |
| **M** | 40px | 16px | 16px | `btn-size-m` |
| **L** | 48px | 24px | 16px | `btn-size-l` |
| **XL** | 56px | 32px | 18px | `btn-size-xl` |

**Button Variants & States (Primary 예시)**
| Variant | Default | Hover | Active | Focus | Disabled | Naming Convention |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Fill** | `bg-primary-500 text-white` | `bg-primary-600` | `bg-primary-700` | `ring-2 ring-primary-500 ring-offset-2` | `bg-gray-300 text-gray-500` | `btn-variant-fill` |
| **Outline** | `border border-primary-500 text-primary-500` | `bg-primary-50` | `bg-primary-100` | `ring-2 ring-primary-500` | `border-gray-300 text-gray-400` | `btn-variant-outline` |
| **Ghost** | `text-primary-500 bg-transparent` | `bg-primary-50` | `bg-primary-100` | `ring-2 ring-primary-500` | `text-gray-400` | `btn-variant-ghost` |

*Button Type:* `Icon-Left`, `Icon-Right`, `None-Icon` 지원
*Button Status:* `Primary`, `Success`, `Warning`, `Danger`, `Info`, `Neutral`, `Dark` (총 7종 색상 스키마 적용 가능)

### 📝 Form Elements (Input, Select, Text Area)

| State | Border / Background | Text Color | Naming Convention |
| :--- | :--- | :--- | :--- |
| **Default** | `border-gray-300 bg-white` | `text-gray-900` | `form-state-default` |
| **Focused** | `border-primary-500 ring-1 ring-primary-500` | `text-gray-900` | `form-state-focused` |
| **Filled** | `border-gray-300 bg-gray-50` | `text-gray-900` | `form-state-filled` |
| **Error** | `border-danger-500 text-danger-500` | `text-danger-500` | `form-state-error` |
| **Success** | `border-success-500 text-success-500` | `text-success-500` | `form-state-success` |
| **Disabled**| `border-gray-200 bg-gray-100` | `text-gray-400` | `form-state-disabled` |

---

## 3. Components 2 (Other UI Elements)

| Component | UI Type | Naming Convention / Style Spec |
| :--- | :--- | :--- |
| **Selection** | Checkbox, Radio, Toggle | `Primary` 색상을 활성화(Checked) 상태로 사용. 크기는 16px, 20px, 24px 제공. |
| **Feedback** | Alert, Tooltip, Progress Bar | `Semantic` 컬러 매핑 (Success, Warning, Error, Info). Progress Bar 높이는 4px, 8px 지원. |
| **Data Display** | Tag, Avatar, Card | Tag: `rounded-full` 뱃지 형태. Avatar: `rounded-full` 이미지 컨테이너. Card: `shadow-md`, `rounded-xl`, `border-gray-200` 적용. |
