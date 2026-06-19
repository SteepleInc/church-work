import { recordFromCollection } from "@/data/collection-query-state";
import { useTemplatesCollection } from "@/data/templates/templatesData.app";

export function useTemplateData(params: { readonly templateId: string }) {
  const templates = useTemplatesCollection({ churchId: null });
  const state = recordFromCollection(templates, (template) => template.id === params.templateId);

  return {
    loading: state.loading,
    templateOpt: state.record,
  };
}
