<template>
  <div>
    <button @click="toggleMode">
      {{ isEditMode ? 'Режим просмотра' : 'Режим редактирования' }}
    </button>

    <div v-if="isEditMode">
      <button :disabled="!canUndo" @click="undo">← Отменить</button>
      <button :disabled="!canRedo" @click="redo">Повторить →</button>
    </div>

    <ag-grid-vue
        class="ag-theme-alpine"
        :columnDefs="columnDefs"
        :rowData="rowData"
        :treeData="true"
        :getDataPath="getDataPath"
        :autoGroupColumnDef="autoGroupColumnDef"
        :context="context"
        :domLayout="'autoHeight'"
        @grid-ready="onGridReady"
        @cell-value-changed="onCellValueChanged"
    ></ag-grid-vue>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { AgGridVue } from 'ag-grid-vue3';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { ClientSideRowModelModule, ModuleRegistry, TreeDataModule } from 'ag-grid-enterprise';
import {TreeItem, TreeStore} from './TreeStore';

ModuleRegistry.registerModules([ClientSideRowModelModule, TreeDataModule]);

const initialItems = [
  { id: 1, parent: null, label: 'Айтем 1' },
  { id: '2', parent: 1, label: 'Айтем 2' },
  { id: 3, parent: 1, label: 'Айтем 3' },
  { id: 4, parent: '2', label: 'Айтем 4' },
  { id: 5, parent: '2', label: 'Айтем 5' },
  { id: 6, parent: '2', label: 'Айтем 6' },
  { id: 7, parent: 4, label: 'Айтем 7' },
  { id: 8, parent: 4, label: 'Айтем 8' },
];

const treeStore = new TreeStore(initialItems);
const isEditMode = ref(false);

const history = ref<Array<Array<TreeItem>>>([[...initialItems]]);
const currentHistoryIndex = ref(0);

const rowData = ref(treeStore.getAll());
const gridApi = ref<any>(null);

const addChild = (parentId: number | string) => {
  const newId = Date.now();
  const newItem = { id: newId, parent: parentId, label: 'Новый айтем' };
  treeStore.addItem(newItem);
  saveStateToHistory();
  rowData.value = [...treeStore.getAll()];
  if (gridApi.value) {
    gridApi.value.setRowData(rowData.value);
  }
};

const removeItem = (id: number | string) => {
  treeStore.removeItem(id);
  saveStateToHistory();
  refreshGrid();
};

const context = ref({
  addChild,
  removeItem,
  updateItem: (updatedItem: any) => {
    treeStore.updateItem(updatedItem);
    saveStateToHistory();
    refreshGrid();
  },
});

const columnDefs = ref([
  {
    field: 'label',
    headerName: 'Категория',
    minWidth: 200,
    editable: true,
    cellRenderer: 'agGroupCellRenderer',
    cellRendererParams: {
      suppressCount: true,
      innerRenderer: (params: any) => {
        const node = params.node;
        const isGroup = node.allChildrenCount > 0;
        return isGroup ? 'Группа' : 'Элемент';
      },
    },
  },
  {
    field: 'label',
    headerName: 'Наименование',
    editable: computed(() => isEditMode.value),
    cellRenderer: (params: any) => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '8px';

    const labelSpan = document.createElement('span');
    labelSpan.innerText = params.value;
    div.appendChild(labelSpan);

    if (isEditMode.value) {
      const addButton = document.createElement('button');
      addButton.innerText = '+';
      addButton.classList.add('action-button', 'add-button');
      addButton.addEventListener('click', () => params.context.addChild(params.data.id));

      const removeButton = document.createElement('button');
      removeButton.innerText = 'x';
      removeButton.classList.add('action-button', 'remove-button');
      removeButton.addEventListener('click', () => params.context.removeItem(params.data.id));

      div.appendChild(addButton);
      div.appendChild(removeButton);

      let isEditing = false;
      let originalValue = params.value;

      div.addEventListener('dblclick', () => {
        if (isEditing) return;

        isEditing = true;

        const input = document.createElement('input');
        input.value = originalValue;
        input.style.flex = '1';
        input.style.padding = '5px';
        input.style.border = '1px solid #ccc';
        input.style.borderRadius = '4px';

        div.replaceChild(input, labelSpan);

        input.focus();

        input.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            const newValue = input.value.trim();

            if (newValue !== originalValue) {
              const updatedItem = { ...params.data, label: newValue };

              originalValue = newValue;
              params.context.updateItem(updatedItem);
            }

            labelSpan.innerText = newValue;
            div.replaceChild(labelSpan, input);
            isEditing = false;
          }
        });

        input.addEventListener('blur', () => {
          labelSpan.innerText = originalValue;
          div.replaceChild(labelSpan, input);
          isEditing = false;
        });
      });

    }
    return div;
    }
  },
]);

const getDataPath = (data: any) => {
  const path = [];
  let current = data;
  while (current) {
    path.unshift(current.label);
    current = treeStore.getItem(current.parent);
  }
  return path;
};

const autoGroupColumnDef = ref({
  field: 'id',
  headerName: 'ID',
  width: 100,
  cellRenderer: (params: any) => params.value.toString(),
});

const toggleMode = () => {
  isEditMode.value = !isEditMode.value;
  if (gridApi.value) {
    gridApi.value.refreshCells();
    gridApi.value.redrawRows();
  }
};

const saveStateToHistory = () => {
  const currentState = JSON.parse(JSON.stringify(treeStore.getAll()));

  history.value = history.value.slice(0, currentHistoryIndex.value + 1);

  history.value.push(currentState);

  currentHistoryIndex.value++;

};
const undo = () => {
  if (canUndo.value) {
    currentHistoryIndex.value--;
    const previousState = JSON.parse(JSON.stringify(history.value[currentHistoryIndex.value]));
    treeStore.updateItems(previousState);
    refreshGrid();
  }
};

const redo = () => {
  if (canRedo.value) {
    currentHistoryIndex.value++;
    const nextState = JSON.parse(JSON.stringify(history.value[currentHistoryIndex.value]));
    treeStore.updateItems(nextState);
    refreshGrid();
  }
};


const canUndo = computed(() => currentHistoryIndex.value > 0);
const canRedo = computed(() => currentHistoryIndex.value < history.value.length - 1);

const refreshGrid = () => {
  if (gridApi.value) {
    rowData.value = treeStore.getAll();
    gridApi.value.setRowData(rowData.value);
    gridApi.value.refreshCells({ force: true });
  }
};

const onGridReady = (params: any) => {
  gridApi.value = params.api;
  refreshGrid();
};

const onCellValueChanged = (event: any) => {
  const updatedItem = { ...event.data, label: event.newValue };
  treeStore.updateItem(updatedItem);
  refreshGrid();
};

</script>

<style scoped>
button {
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  padding: 10px 20px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.2s ease;
  margin: 5px;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
  transform: scale(1.05);
}

div > div {
  margin-bottom: 20px;
}

button:first-of-type {
  width: auto;
}

.ag-theme-alpine {
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-top: 20px;
}


.ag-cell-action-buttons button {
  background-color: #28a745;
  color: white;
}
</style>

