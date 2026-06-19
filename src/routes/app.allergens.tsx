import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { SimpleCrud } from "@/components/simple-crud";

export const Route = createFileRoute("/app/allergens")({
  head: () => ({ meta: [{ title: "Alergênicos — Etiquetas" }] }),
  component: () => (
    <>
      <PageHeader title="Alergênicos" description="Substâncias alergênicas declaradas nos rótulos." />
      <SimpleCrud table="allergens" title="alergênico" fields={[
        { name: "name", label: "Nome", required: true },
        { name: "code", label: "Código" },
        { name: "description", label: "Descrição" },
      ]} />
    </>
  ),
});
