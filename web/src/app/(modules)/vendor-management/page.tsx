import ModulePlaceholder from "../../../components/ModulePlaceholder";

export default function VendorManagementPage() {
  return (
    <ModulePlaceholder
      title="Vendor Management"
      subtitle="Module scaffold created. Logic and formulas will be added after Excel mappings."
      links={[
        {
          href: "/vendor-management/supplier-kpi-dashboard",
          label: "Supplier KPI Dashboard",
        },
      ]}
    />
  );
}

