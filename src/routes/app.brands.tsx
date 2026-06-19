import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { SimpleCrud } from "@/components/simple-crud";

export const Route = createFileRoute("/app/brands")({
  head: () => ({ meta: [{ title: "Marcas — Etiquetas" }] }),
  component: () => (
    <>
      <PageHeader title="Marcas" description="Marcas vinculadas aos produtos da empresa." />
      <SimpleCrud table="brands" title="marca" fields={[
        { name: "name", label: "Nome", required: true },
        { name: "description", label: "Descrição" },
      ]} />
    </>
  ),
});
