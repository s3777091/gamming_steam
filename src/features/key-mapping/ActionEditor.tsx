import { useState } from 'react';
import { Modal, ScrollView, Switch, TextInput, View } from 'react-native';
import { useTheme } from '@/theme';
import { T } from '@/ui/Text';
import { CONTROLS, controlLabel, type Binding, type Point, type Step } from './model';
import { MappingButton, MappingCard, mappingStyles } from './MappingUi';

export function MappingField({ label, value, onChange, numeric = false }: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean }) {
  const { colors, glass } = useTheme();
  return <View style={{ minWidth: 100, flexGrow: 1, gap: 4 }}><T size={11} color={colors.text3}>{label}</T><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'} selectTextOnFocus={numeric} style={{ color: colors.text, backgroundColor: glass.control, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: glass.controlBorder, minHeight: 42 }} /></View>;
}
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState({ value, text: String(value) });
  if (!Object.is(draft.value, value)) setDraft({ value, text: Number.isFinite(value) ? String(value) : '' });
  return <MappingField label={label} value={draft.text} numeric onChange={text => { const next = text.trim() === '' ? NaN : Number(text.replace(',', '.')); setDraft({ value: next, text }); onChange(next); }} />;
}
const DEFAULT_POINT = { x: 0.5, y: 0.5 };
export function makeStep(type: Step['type'], point: Point = DEFAULT_POINT): Step {
  if (type === 'wait') return { type, durationMs: 300 };
  if (type === 'random') return { type, minMs: 1000, maxMs: 5000 };
  if (type === 'double') return { type, point, durationMs: 50, intervalMs: 150 };
  if (type === 'drag') return { type, point, end: { x: Math.min(1, point.x + 0.2), y: point.y }, durationMs: 600, initialHoldMs: 0 };
  return { type, point, durationMs: type === 'hold' ? 2000 : 50 };
}
const STEP_LABELS: Record<Step['type'], string> = { tap: 'Chạm', hold: 'Giữ', double: 'Chạm đôi', wait: 'Chờ', random: 'Chờ ngẫu nhiên', drag: 'Kéo / vuốt' };

export function ActionEditor({ binding, onChange, onClose, onDelete, onPick }: {
  binding: Binding; onChange: (binding: Binding) => void; onClose: () => void; onDelete: () => void;
  onPick: (index: number, end: boolean) => void;
}) {
  const { colors } = useTheme();
  const updateStep = (index: number, next: Step) => onChange({ ...binding, steps: binding.steps.map((s, i) => i === index ? next : s) });
  const preset = (kind: Step['type'] | 'delay' | 'range') => onChange({ ...binding, physicalHold: false, steps: kind === 'delay' ? [makeStep('wait'), makeStep('tap', binding.point)] : kind === 'range' ? [makeStep('random'), makeStep('tap', binding.point)] : [makeStep(kind, binding.point)] });
  return <Modal transparent animationType="fade" visible onRequestClose={onClose}><View style={mappingStyles.modal}>
    <View style={{ width: '100%', maxWidth: 680, maxHeight: '100%', backgroundColor: colors.bg, borderRadius: 20, padding: 16, gap: 10 }}>
      <View style={mappingStyles.row}><T size={17} weight="bold" style={{ flex: 1 }}>Thao tác · {binding.controls.map(controlLabel).join(' + ')}</T><MappingButton onPress={onClose}>Xong</MappingButton></View>
      <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
        <MappingField label="Tên thao tác / macro" value={binding.name} onChange={name => onChange({ ...binding, name })} />
        <T size={12} weight="bold">Tổ hợp kích hoạt (tối đa 4 nút)</T>
        <View style={mappingStyles.row}>{CONTROLS.map(control => <MappingButton key={control} active={binding.controls.includes(control)} onPress={() => {
          const next = binding.controls.includes(control) ? binding.controls.filter(c => c !== control) : [...binding.controls, control];
          if (next.length && next.length <= 4) onChange({ ...binding, controls: next });
        }}>{controlLabel(control)}</MappingButton>)}</View>
        <T size={11} color={colors.text3}>Tổ hợp dài hơn được ưu tiên; cửa sổ ghép nút 60 ms. Nút thuộc tổ hợp được dành cho mapping.</T>
        <T size={12} weight="bold">Cơ bản</T>
        <View style={mappingStyles.row}>{(['tap', 'hold', 'double'] as const).map(type => <MappingButton key={type} onPress={() => preset(type)}>{STEP_LABELS[type]}</MappingButton>)}</View>
        <T size={12} weight="bold">Thời gian & cử chỉ</T>
        <View style={mappingStyles.row}><MappingButton onPress={() => preset('delay')}>Chạm trễ</MappingButton><MappingButton onPress={() => preset('range')}>Range Click</MappingButton><MappingButton onPress={() => preset('drag')}>Kéo / vuốt</MappingButton></View>
        <T size={12} weight="bold">Macro · chạy tuần tự</T>
        {binding.steps.map((step, index) => <MappingCard key={index}>
          <View style={mappingStyles.row}><T size={13} weight="bold" style={{ flex: 1 }}>{index + 1}. {STEP_LABELS[step.type]}</T>
            <MappingButton disabled={index === 0} onPress={() => { const steps = [...binding.steps]; [steps[index - 1], steps[index]] = [steps[index], steps[index - 1]]; onChange({ ...binding, steps }); }}>↑</MappingButton>
            <MappingButton disabled={index === binding.steps.length - 1} onPress={() => { const steps = [...binding.steps]; [steps[index + 1], steps[index]] = [steps[index], steps[index + 1]]; onChange({ ...binding, steps }); }}>↓</MappingButton>
            <MappingButton danger disabled={binding.steps.length === 1} onPress={() => onChange({ ...binding, steps: binding.steps.filter((_, i) => i !== index), physicalHold: false })}>Xóa bước</MappingButton>
          </View>
          <View style={mappingStyles.row}>
            {step.type === 'random' ? <><NumberField label="Min (ms)" value={step.minMs} onChange={minMs => updateStep(index, { ...step, minMs })} /><NumberField label="Max (ms)" value={step.maxMs} onChange={maxMs => updateStep(index, { ...step, maxMs })} /></> : <NumberField label="Thời gian (ms)" value={step.durationMs} onChange={durationMs => updateStep(index, { ...step, durationMs })} />}
            {step.type === 'double' ? <NumberField label="Khoảng cách hai lần (ms)" value={step.intervalMs} onChange={intervalMs => updateStep(index, { ...step, intervalMs })} /> : null}
            {step.type === 'drag' ? <NumberField label="Giữ trước khi kéo (ms)" value={step.initialHoldMs} onChange={initialHoldMs => updateStep(index, { ...step, initialHoldMs })} /> : null}
          </View>
          {'point' in step ? <><View style={mappingStyles.row}><NumberField label="X (0–1)" value={step.point.x} onChange={x => updateStep(index, { ...step, point: { ...step.point, x } })} /><NumberField label="Y (0–1)" value={step.point.y} onChange={y => updateStep(index, { ...step, point: { ...step.point, y } })} /><MappingButton onPress={() => onPick(index, false)}>Đặt trên ảnh</MappingButton></View>
            {step.type === 'drag' ? <View style={mappingStyles.row}><NumberField label="X cuối (0–1)" value={step.end.x} onChange={x => updateStep(index, { ...step, end: { ...step.end, x } })} /><NumberField label="Y cuối (0–1)" value={step.end.y} onChange={y => updateStep(index, { ...step, end: { ...step.end, y } })} /><MappingButton onPress={() => onPick(index, true)}>Đặt điểm cuối</MappingButton></View> : null}</> : null}
        </MappingCard>)}
        <View style={mappingStyles.row}>{(Object.keys(STEP_LABELS) as Step['type'][]).map(type => <MappingButton key={type} disabled={binding.steps.length >= 32} onPress={() => onChange({ ...binding, physicalHold: false, steps: [...binding.steps, makeStep(type, binding.point)] })}>+ {STEP_LABELS[type]}</MappingButton>)}</View>
        <NumberField label="Số lần lặp (1–20, tối đa 5 phút)" value={binding.repeat} onChange={repeat => onChange({ ...binding, repeat })} />
        {binding.steps.length === 1 && binding.steps[0].type === 'hold' ? <View style={mappingStyles.row}><T size={12} style={{ flex: 1 }}>Giữ đến khi nhả nút (tối đa 60 giây)</T><Switch value={binding.physicalHold} onValueChange={physicalHold => onChange({ ...binding, physicalHold, repeat: 1 })} /></View> : null}
        <MappingButton danger onPress={onDelete}>Xóa mapping</MappingButton>
      </ScrollView>
    </View>
  </View></Modal>;
}
