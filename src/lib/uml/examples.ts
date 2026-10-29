import type { AiDiagram } from "./ai-schema";
import type { Diagram, DiagramType, Visibility } from "./types";
import { aiToDiagram } from "./ai-convert";
import { autoLayout } from "./layout";

type El = AiDiagram["elements"][number];
type Rel = AiDiagram["relationships"][number];

const el = (key: string, kind: El["kind"], name: string, extra: Partial<El> = {}): El => ({
  key, kind, name, stereotype: null, isAbstract: false, attributes: [], operations: [], literals: [],
  participantType: null, classifier: null, documentation: null, ...extra,
});
const rel = (kind: Rel["kind"], source: string, target: string, extra: Partial<Rel> = {}): Rel => ({
  kind, source, target, label: null, sourceMultiplicity: null, targetMultiplicity: null, sourceRole: null,
  targetRole: null, navigable: null, guard: null, messageType: null, ...extra,
});
const attr = (s: string) => {
  const m = s.match(/^([+\-#~])\s*(\w+)\s*:\s*(.+)$/)!;
  return { visibility: m[1] as Visibility, name: m[2], type: m[3].trim(), isStatic: false };
};
const op = (s: string) => {
  const m = s.match(/^([+\-#~])\s*(\w+)\((.*)\)\s*:\s*(.+)$/)!;
  const parameters = m[3] ? m[3].split(",").map((p) => { const [n, t] = p.split(":").map((x) => x.trim()); return { name: n, type: t }; }) : [];
  return { visibility: m[1] as Visibility, name: m[2], parameters, returnType: m[4].trim(), isStatic: false, isAbstract: false };
};

const shopping: AiDiagram = {
  diagramName: "Online Shopping – Domain Model",
  summary: "Core domain of an online shop.",
  systemName: null,
  elements: [
    el("Customer", "class", "Customer", { attributes: ["- customerId: UUID", "- email: String", "- passwordHash: String"].map(attr), operations: ["+ register(): Boolean", "+ login(password: String): Session", "+ updateProfile(): void"].map(op) }),
    el("Cart", "class", "Cart", { attributes: ["- cartId: UUID"].map(attr), operations: ["+ addItem(product: Product, qty: Integer): void", "+ removeItem(product: Product): void", "+ total(): Decimal"].map(op) }),
    el("CartItem", "class", "CartItem", { attributes: ["- quantity: Integer"].map(attr), operations: ["+ subtotal(): Decimal"].map(op) }),
    el("Product", "class", "Product", { attributes: ["- productId: UUID", "- name: String", "- price: Decimal", "- stock: Integer"].map(attr), operations: ["+ isAvailable(qty: Integer): Boolean"].map(op) }),
    el("Order", "class", "Order", { attributes: ["- orderId: UUID", "- placedAt: DateTime", "- status: OrderStatus"].map(attr), operations: ["+ place(): void", "+ cancel(): Boolean", "+ total(): Decimal"].map(op) }),
    el("OrderLine", "class", "OrderLine", { attributes: ["- quantity: Integer", "- unitPrice: Decimal"].map(attr), operations: [] }),
    el("Payment", "class", "Payment", { isAbstract: true, attributes: ["- paymentId: UUID", "- amount: Decimal", "- status: PaymentStatus"].map(attr), operations: ["+ process(): PaymentResult", "+ refund(): Boolean"].map(op) }),
    el("CardPayment", "class", "CardPayment", { attributes: ["- cardToken: String"].map(attr), operations: [] }),
    el("WalletPayment", "class", "WalletPayment", { attributes: ["- walletId: String"].map(attr), operations: [] }),
    el("PaymentGateway", "interface", "PaymentGateway", { operations: ["+ charge(amount: Decimal, token: String): PaymentResult"].map(op) }),
    el("PaymentResult", "class", "PaymentResult", { attributes: ["- success: Boolean", "- reference: String"].map(attr) }),
    el("Session", "class", "Session", { attributes: ["- token: String", "- expiresAt: DateTime"].map(attr) }),
    el("OrderStatus", "enumeration", "OrderStatus", { literals: ["PENDING", "PAID", "SHIPPED", "CANCELLED"] }),
    el("PaymentStatus", "enumeration", "PaymentStatus", { literals: ["INITIATED", "AUTHORIZED", "FAILED", "REFUNDED"] }),
  ],
  relationships: [
    rel("composition", "Customer", "Cart", { label: "owns", sourceMultiplicity: "1", targetMultiplicity: "0..1" }),
    rel("composition", "Cart", "CartItem", { label: "contains", sourceMultiplicity: "1", targetMultiplicity: "*" }),
    rel("association", "CartItem", "Product", { label: "refers to", sourceMultiplicity: "*", targetMultiplicity: "1", navigable: true }),
    rel("association", "Customer", "Order", { label: "places", sourceMultiplicity: "1", targetMultiplicity: "*" }),
    rel("composition", "Order", "OrderLine", { label: "lines", sourceMultiplicity: "1", targetMultiplicity: "1..*" }),
    rel("association", "OrderLine", "Product", { label: "for", sourceMultiplicity: "*", targetMultiplicity: "1", navigable: true }),
    rel("association", "Order", "Payment", { label: "paid by", sourceMultiplicity: "1", targetMultiplicity: "0..*" }),
    rel("generalization", "CardPayment", "Payment"),
    rel("generalization", "WalletPayment", "Payment"),
    rel("dependency", "Payment", "PaymentGateway", { label: "uses" }),
    rel("dependency", "Payment", "PaymentResult"),
    rel("dependency", "Customer", "Session"),
    rel("dependency", "Order", "OrderStatus"),
    rel("dependency", "Payment", "PaymentStatus"),
  ],
  assumptions: [
    { category: "explicit", text: "Customers, products, carts, orders, and payments are required domain concepts." },
    { category: "inferred", text: "A customer has at most one active cart at a time." },
    { category: "inferred", text: "Order lines capture the unit price at purchase time so later price changes do not alter past orders." },
    { category: "question", text: "Can a single order be paid with multiple payment methods (split payment)?" },
    { category: "recommendation", text: "Store only a password hash; the class diagram does not by itself guarantee secure implementation." },
  ],
};

const library: AiDiagram = {
  diagramName: "Library – Use Cases",
  summary: "Main library services.",
  systemName: "Library Management System",
  elements: [
    el("member", "actor", "Member"),
    el("librarian", "actor", "Librarian"),
    el("payments", "actor", "Payment Provider", { stereotype: "system" }),
    el("search", "useCase", "Search Catalog"),
    el("borrow", "useCase", "Borrow Book"),
    el("return", "useCase", "Return Book"),
    el("reserve", "useCase", "Reserve Book"),
    el("auth", "useCase", "Authenticate"),
    el("fine", "useCase", "Pay Fine"),
    el("manage", "useCase", "Manage Inventory"),
  ],
  relationships: [
    rel("association", "member", "search"),
    rel("association", "member", "borrow"),
    rel("association", "member", "return"),
    rel("association", "member", "reserve"),
    rel("association", "librarian", "manage"),
    rel("association", "librarian", "borrow"),
    rel("association", "fine", "payments"),
    rel("include", "borrow", "auth"),
    rel("include", "reserve", "auth"),
    rel("include", "manage", "auth"),
    rel("extend", "fine", "return", { label: "book is overdue" }),
  ],
  assumptions: [
    { category: "inferred", text: "Librarians can check out books on behalf of members." },
    { category: "question", text: "Should members be able to renew loans online?" },
  ],
};

const checkout: AiDiagram = {
  diagramName: "Checkout – Sequence",
  summary: "Customer checks out a cart and pays by card.",
  systemName: null,
  elements: [
    el("customer", "lifeline", "customer", { participantType: "actor", classifier: "Customer" }),
    el("ui", "lifeline", "web", { classifier: "CheckoutPage" }),
    el("orders", "lifeline", "orderService", { classifier: "OrderService" }),
    el("pay", "lifeline", "paymentService", { classifier: "PaymentService" }),
    el("gw", "lifeline", "gateway", { classifier: "PaymentGateway" }),
  ],
  relationships: [
    rel("message", "customer", "ui", { label: "checkout()", messageType: "sync" }),
    rel("message", "ui", "orders", { label: "createOrder(cartId)", messageType: "sync" }),
    rel("message", "orders", "orders", { label: "validateStock()", messageType: "sync" }),
    rel("message", "orders", "pay", { label: "processPayment(amount: Decimal)", messageType: "sync" }),
    rel("message", "pay", "gw", { label: "charge(amount, token)", messageType: "sync" }),
    rel("message", "gw", "pay", { label: "PaymentResult", messageType: "reply" }),
    rel("message", "pay", "orders", { label: "PaymentResult", messageType: "reply" }),
    rel("message", "orders", "ui", { label: "orderConfirmation", messageType: "reply" }),
    rel("message", "orders", "customer", { label: "sendReceiptEmail()", messageType: "async" }),
    rel("message", "ui", "customer", { label: "show confirmation", messageType: "reply" }),
  ],
  assumptions: [{ category: "inferred", text: "Receipt emails are sent asynchronously after payment succeeds." }],
};

const fulfillment: AiDiagram = {
  diagramName: "Order Fulfillment – Activity",
  summary: "Order processing with parallel payment and inventory reservation.",
  systemName: null,
  elements: [
    el("start", "initial", ""),
    el("receive", "action", "Receive Order"),
    el("validate", "action", "Validate Order"),
    el("valid", "decision", ""),
    el("reject", "action", "Notify Rejection"),
    el("fork", "fork", ""),
    el("pay", "action", "Process Payment"),
    el("reserve", "action", "Reserve Inventory"),
    el("join", "join", ""),
    el("ship", "action", "Ship Order"),
    el("merge", "merge", ""),
    el("end", "final", ""),
  ],
  relationships: [
    rel("controlFlow", "start", "receive"),
    rel("controlFlow", "receive", "validate"),
    rel("controlFlow", "validate", "valid"),
    rel("controlFlow", "valid", "fork", { guard: "valid" }),
    rel("controlFlow", "valid", "reject", { guard: "else" }),
    rel("controlFlow", "fork", "pay"),
    rel("controlFlow", "fork", "reserve"),
    rel("controlFlow", "pay", "join"),
    rel("controlFlow", "reserve", "join"),
    rel("controlFlow", "join", "ship"),
    rel("controlFlow", "ship", "merge"),
    rel("controlFlow", "reject", "merge"),
    rel("controlFlow", "merge", "end"),
  ],
  assumptions: [{ category: "question", text: "What happens if payment succeeds but inventory reservation fails?" }],
};

export const EXAMPLES: Record<DiagramType, AiDiagram> = {
  class: shopping,
  useCase: library,
  sequence: checkout,
  activity: fulfillment,
};

export function buildExample(type: DiagramType, base?: Diagram): Diagram {
  const { diagram } = aiToDiagram(EXAMPLES[type], type, undefined);
  const named = base ? { ...diagram, id: base.id, name: base.name, createdAt: base.createdAt } : diagram;
  return autoLayout(named);
}
