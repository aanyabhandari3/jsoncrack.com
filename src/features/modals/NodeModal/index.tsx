import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Group, Textarea } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";
import { modify, applyEdits, parse as parseJsonc } from "jsonc-parser";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj: Record<string, any> = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

const getEditableJson = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) {
    // primitive node
    return JSON.stringify(nodeRows[0].value, null, 2);
  }

  const obj: Record<string, any> = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const getJson = useJson(state => state.getJson);
  const setGraph = useGraph(state => state.setGraph);
  const setContents = useFile(state => state.setContents);
  const setSelectedNode = useGraph(state => state.setSelectedNode);

  const [isEditing, setIsEditing] = React.useState(false);
  const [localValue, setLocalValue] = React.useState<string>("{}");
  const [originalValue, setOriginalValue] = React.useState<string>("{}");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const ed = getEditableJson(nodeData?.text ?? []);
    setLocalValue(ed);
    setOriginalValue(ed);
    setIsEditing(false);
    setError(null);
  }, [nodeData, opened]);

  const handleEdit = () => {
    setOriginalValue(localValue);
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setLocalValue(originalValue);
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    try {
      // parse localValue as JSON
      const parsed = parseJsonc(localValue);

      // current full json
      const currentJson = getJson();

      const path = nodeData?.path ?? [];

      // apply edit to the json string preserving formatting
      const edits = modify(currentJson, path, parsed, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      });

      const newJson = applyEdits(currentJson, edits);

  // update the left editor contents (this will also update useJson via setContents)
  await setContents({ contents: newJson, hasChanges: true });

  // re-run graph parser and re-select node at same path if possible
  setGraph(newJson);
      const nodes = useGraph.getState().nodes;
      const match = nodes.find(n => JSON.stringify(n.path ?? []) === JSON.stringify(path));
      if (match) setSelectedNode(match as NodeData);

      setIsEditing(false);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Flex gap="sm" align="center">
              {!isEditing && <Button size="xs" variant="outline" onClick={handleEdit}>Edit</Button>}
              {isEditing && (
                <Group>
                  <Button size="xs" onClick={handleSave}>Save</Button>
                  <Button size="xs" variant="subtle" onClick={handleCancel}>Cancel</Button>
                </Group>
              )}
              <CloseButton onClick={onClose} />
            </Flex>
          </Flex>
          <ScrollArea.Autosize mah={250} maw={600}>
            {!isEditing ? (
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            ) : (
              <Textarea
                autosize
                minRows={3}
                value={localValue}
                onChange={e => setLocalValue(e.currentTarget.value)}
                maw={600}
              />
            )}
          </ScrollArea.Autosize>
          {error && (
            <Text fz="xs" color="red">
              {error}
            </Text>
          )}
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
