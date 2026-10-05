export const initialDatabase = {
  _initialized: true,
  settings: {
    storeName: "بيت العيلة",
    logoUrl: "/logo.jpg",
    slogan: "لكل العيلة - كل ما تحتاجه الأسرة والطالب في مكان واحد - أدوات مكتبية • كتب خارجية • مركز طباعة ومذكرات • هدايا وسناكس",
    phone: "",
    whatsapp: "",
    address: "مكتبة بيت العيلة",
    receiptFooter: "شكراً لزيارتكم مكتبة بيت العيلة! نسعد بخدمتكم دائماً",
    taxRate: 0,
    deliveryFee: 25,
    freeDeliveryThreshold: 500,
    cloudSyncEnabled: true,
    cloudEndpoint: "https://beit-el-aila-erp-default-rtdb.firebaseio.com/state.json",
    lastSyncTime: new Date().toISOString(),
    branchId: "MAIN-POS-01",
    printPrices: {
      bwSingleA4: 1.0,
      bwDoubleA4: 1.5,
      colorSingleA4: 5.0,
      colorDoubleA4: 8.0,
      bwSingleA3: 2.5,
      colorSingleA3: 10.0,
      spiralBindingSmall: 15.0,
      spiralBindingLarge: 25.0,
      thermalBinding: 20.0,
      laminationA4: 10.0,
      laminationId: 5.0,
      paperCostPerSheetA4: 0.45,
      tonerCostPerPageBW: 0.15,
      tonerCostPerPageColor: 1.2
    },
    copierCounters: [
      { id: "MAC-1", name: "ماكينة تصوير أبيض وأسود (1)", currentCounter: 0, lastServiceCounter: 0, status: "active" },
      { id: "MAC-2", name: "ماكينة طباعة ألوان (2)", currentCounter: 0, lastServiceCounter: 0, status: "active" }
    ]
  },

  users: [
    { id: "USR-1", name: "المدير العام (إدارة بيت العيلة)", username: "admin", pin: "1234", role: "admin", permissions: ["all"], active: true },
    { id: "USR-2", name: "كاشير بيت العيلة", username: "cashier", pin: "1111", role: "cashier", permissions: ["pos", "print", "orders", "customers"], active: true }
  ],

  categories: [],

  products: [],

  studyNotes: [],

  noteReservations: [],

  printJobs: [],

  customers: [
    {
      id: "CUS-1",
      name: "عميل نقدي (كاشير)",
      phone: "-",
      type: "walkin",
      balance: 0,
      creditLimit: 0,
      loyaltyPoints: 0,
      totalPurchases: 0,
      notes: "الحساب الافتراضي للمبيعات النقدية السريعة",
      transactions: []
    }
  ],

  suppliers: [],

  sales: [],

  onlineOrders: [],

  expenses: [],

  shifts: [],

  syncQueue: []
};
