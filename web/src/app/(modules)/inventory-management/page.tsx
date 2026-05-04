import ModulePlaceholder from "../../../components/ModulePlaceholder";

export default function InventoryManagementPage() {
  return (
    <ModulePlaceholder
      title="Inventory Management"
      subtitle="Module scaffold created. Logic and formulas will be added after Excel mappings."
      links={[
        { href: "/inventory-management/abc-analysis", label: "ABC Analysis" },
        { href: "/inventory-management/eoq-calculator", label: "EOQ Calculator" },
        { href: "/inventory-management/reorder-point", label: "Reorder Point (ROP)" },
        { href: "/inventory-management/safety-stock", label: "Safety Stock" },
      ]}
    />
  );
}

