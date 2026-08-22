import { Product } from '../types';

export interface CategoryGroup {
  category: string;
  items: string[];
}

export const NEW_SEED_CATEGORIES: CategoryGroup[] = [
  {
    category: "سوق 21 أجهزة بركانية",
    items: [
      "شواية لحم",
      "ثلاجة حلويات",
      "ماكينة شاورما كهرباء",
      "مضارب",
      "آيس ميكر"
    ]
  },
  {
    category: "عام",
    items: [
      "طاولة السندوتش",
      "صواني قرص",
      "ميزان ساعة",
      "شواية مشكل",
      "حوضات",
      "ديسبنسر",
      "صحن السندوتش",
      "كرتونة زجاج",
      "شيخ الشواية",
      "فرامة أكياس + أخشاب",
      "شاورما دجاج",
      "غلاية لتر",
      "مبرد عصير",
      "منشر لحوم",
      "غلاية لتر كهرباء",
      "شواية عرض السندوتش",
      "بسكيت سمك",
      "شواية فراخ",
      "كرتونة صواني",
      "غلاية غاز",
      "قاطع سيخ شتراك صغير",
      "عصارة برتقال"
    ]
  },
  {
    category: "الأجهزة",
    items: [
      "طاولة السندوتش",
      "طباخة 2 شعلة فول",
      "م. السندوتش مرضى",
      "ماكينة بطاطس",
      "مبرد غاز",
      "فريزر هاير جديد",
      "ماكينة سمك",
      "شواية فراخ دوار",
      "غلاية لتر كهرباء",
      "ماكينة بروست ضغط",
      "صندل في مكان نائي يصعب الوصول إليه"
    ]
  },
  {
    category: "المخزن الشروق",
    items: [
      "شوايه فحم",
      "شاورما دبل",
      "غلايه غاز",
      "سخانات بروست أحمر",
      "فرن طبقة غاز",
      "مضرب نابوليتان",
      "بوفيه",
      "قلاب لحوم",
      "مسخنات بروست",
      "توستر",
      "كرتونه تقطيع بطاطس",
      "كرتونه ثلج",
      "قلايه 2 عين غاز",
      "وافل مدور + مربع",
      "ايس ميكر كيلو",
      "منشار لحمه",
      "كسارة ثلج",
      "ماكينه كاشير",
      "بروست",
      "فرن طابق",
      "شوايه لحم",
      "غلايه كهرباء لتر"
    ]
  },
  {
    category: "مخزن العمدة غرب",
    items: [
      "حوض عين",
      "راس شاورما",
      "ثلاجة حلويات",
      "شواية فحم",
      "ثلاجة عرض السندوتش",
      "مفرمة",
      "سخان بروست",
      "كابتشينو",
      "خلاط لتر",
      "سخانة منزلية",
      "مسن بروست",
      "مفرمة لحم",
      "خلاط لتر ك",
      "كسارة ثلج",
      "كبسة دبل مفرد",
      "قلاية مفرد غاز",
      "كبس سمك",
      "سخان ماء بويلر",
      "ماكينة تتبيل بروست",
      "كرتونة صحون",
      "وافل مربع",
      "فرن مدور"
    ]
  }
];

export const ALL_CATEGORIES = [
  "الكل",
  "سوق 21 أجهزة بركانية",
  "عام",
  "الأجهزة",
  "المخزن الشروق",
  "مخزن العمدة غرب"
];

// Generate the complete default 82 products catalog
export const generateDefaultProducts = (): Product[] => {
  const products: Product[] = [];
  let codeNum = 101;
  let idNum = 1;
  const now = new Date().toISOString();

  NEW_SEED_CATEGORIES.forEach((group) => {
    group.items.forEach((item) => {
      let unit = 'قطعة';
      let stock = 10;
      let minStock = 2;

      if (item.includes('كرتونة') || item.includes('كرتونه')) {
        unit = 'كرتونة';
        stock = 25;
        minStock = 5;
      } else if (item.includes('صحن') || item.includes('صواني')) {
        unit = 'درزن';
        stock = 30;
        minStock = 5;
      } else if (item.includes('مضارب')) {
        unit = 'طقم';
        stock = 15;
        minStock = 3;
      } else if (item.includes('خلاط') || item.includes('غلاية') || item.includes('غلايه')) {
        stock = 15;
        minStock = 3;
      } else if (item.includes('فريزر') || item.includes('فرن') || item.includes('بوفيه')) {
        stock = 5;
        minStock = 1;
      }

      products.push({
        id: `prd_${idNum}`,
        code: `NASSER-${codeNum}`,
        name: item,
        category: group.category,
        stock,
        minStock,
        unit,
        description: `صنف معتمد في قسم (${group.category})`,
        updatedAt: now,
      });

      codeNum++;
      idNum++;
    });
  });

  return products;
};

export const DEFAULT_CATALOG_PRODUCTS: Product[] = generateDefaultProducts();
