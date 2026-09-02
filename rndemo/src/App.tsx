import React, {useEffect, useRef, useState} from 'react';
import {Alert, AppState, DeviceEventEmitter, PixelRatio, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';
import {AgenUISurface, agenuiBridge, agenuiEvents, type AgenUIAction} from './native/AgenUISurface';
import {FluidMarkdown} from './native/FluidMarkdown';
import {loadA2uiMessages, loadQuestions} from './contentLoader';
import {handleSelectRepayOption, type RepayOption} from '../contents/账单还款/script';

const todos = [['信用卡账单待还提醒', '本期待还2450元，还款日20号', '去还款'], ['理财产品到期提醒', '您购买的x款理财产品已到期', '去续投'], ['会员权益待领取提醒', '您的x项会员权益待领取', '去领取']] as const;
type Message = {id: string; role: 'user' | 'assistant'; text: string; surfaceId?: string; surfaceHeight?: number};

export default function App() {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextId, setNextId] = useState(1);
  const [questionList, setQuestionList] = useState<string[]>([]);
  const chatRef = useRef<ScrollView>(null);

  useEffect(() => {
    const refreshQuestions = () => loadQuestions().then(setQuestionList);
    refreshQuestions();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refreshQuestions(); });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => chatRef.current?.scrollToEnd({animated: true}));
  }, [messages]);

  useEffect(() => {
    const actionSubscription = agenuiEvents.addListener('AgenUIAction', (action: AgenUIAction) => agenuiBridge.showSelectionAlert(handleSelectRepayOption(action.args.type as RepayOption)));
    const messageSubscription = DeviceEventEmitter.addListener('NativeChatMessage', (payload?: {text?: string}) => submit(payload?.text ?? ''));
    return () => { actionSubscription.remove(); messageSubscription.remove(); };
  }, [nextId]);

  const submit = (value: string) => {
    const text = value.trim();
    if (!text) return;
    const id = String(nextId);
    setNextId(current => current + 1);
    const matched = questionList.some(question => question === text);
    const surfaceId = matched ? `repayment_card_${id}` : undefined;
    const surfaceHeight = matched ? 520 : undefined;
    setMessages(current => [...current, {id: `${id}-user`, role: 'user', text}, {id: `${id}-assistant`, role: 'assistant', text: matched ? '' : '暂无无法回答', surfaceId, surfaceHeight}]);
    if (surfaceId) setTimeout(async () => (await loadA2uiMessages(text, surfaceId)).forEach(message => agenuiBridge.receiveTextChunk(surfaceId, JSON.stringify(message))), 120);
  };

  return <SafeAreaView style={styles.page}><SafeAreaView style={styles.body}>
    <Pressable style={styles.todoHeader} onPress={() => setExpanded(value => !value)}><View style={styles.todoBadge}><Text style={styles.todoBadgeText}>待办</Text></View><Text style={styles.todoTitle}>今日待办 3 项</Text><Text style={styles.todoToggle}>{expanded ? '收起⌃' : '展开⌄'}</Text></Pressable>
    {expanded && <View style={styles.todoList}>{todos.map(([title, body, action]) => <View style={styles.todoRow} key={title}><View style={styles.todoCopy}><Text style={styles.todoItemTitle}>{title}</Text><Text>{body}</Text></View><Pressable onPress={() => Alert.alert(title, action)}><Text style={styles.link}>{action}</Text></Pressable></View>)}</View>}
    <ScrollView ref={chatRef} style={styles.chat} contentContainerStyle={styles.chatContent}>{messages.map(message => <View key={message.id} style={message.role === 'user' ? styles.userMessage : message.surfaceId ? styles.cardMessage : styles.assistantMessage}>{message.text && <FluidMarkdown style={message.role === 'user' ? styles.userMarkdown : styles.assistantMarkdown} markdown={message.text} />}{message.surfaceId && <AgenUISurface style={[styles.surface, {height: message.surfaceHeight ?? 520}]} surfaceId={message.surfaceId} onSurfaceSizeChanged={event => { const height = Math.ceil(event.nativeEvent.height / PixelRatio.get()); if (height > 0) setMessages(current => current.map(item => item.id === message.id && item.surfaceHeight !== height ? {...item, surfaceHeight: height} : item)); }} />}</View>)}</ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.faqBar} contentContainerStyle={styles.faqContent}>{questionList.map(question => <Pressable key={question} style={styles.faqButton} onPress={() => submit(question)}><Text style={styles.faqText}>{question}</Text></Pressable>)}</ScrollView>
  </SafeAreaView></SafeAreaView>;
}

const styles = StyleSheet.create({page: {flex: 1, backgroundColor: '#F5F2EE'}, body: {flex: 1, paddingHorizontal: 12, paddingTop: 12}, todoHeader: {backgroundColor: '#F4C9A3', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center'}, todoBadge: {width: 34, height: 34, borderRadius: 8, backgroundColor: '#FFF8F1', alignItems: 'center', justifyContent: 'center', marginRight: 10}, todoBadgeText: {fontSize: 10, color: '#C45116', fontWeight: '700'}, todoTitle: {fontWeight: '700', flex: 1, color: '#542A19'}, todoToggle: {color: '#542A19', fontWeight: '700'}, todoList: {backgroundColor: '#FFF', paddingHorizontal: 14}, todoRow: {paddingVertical: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EEE2D8'}, todoCopy: {flex: 1}, todoItemTitle: {fontWeight: '700', marginBottom: 4}, link: {color: '#C45116', fontWeight: '700'}, chat: {flex: 1}, chatContent: {paddingVertical: 12, gap: 6}, assistantMessage: {alignSelf: 'flex-start', width: 'auto', backgroundColor: '#E8DCCF', borderRadius: 16, padding: 8}, cardMessage: {alignSelf: 'stretch'}, userMessage: {alignSelf: 'flex-end', width: 'auto', maxWidth: '72%', backgroundColor: '#E8DCCF', borderRadius: 16, padding: 8}, userMarkdown: {height: 32, width: 170, color: '#332822'}, assistantMarkdown: {height: 32, width: 170, color: '#332822'}, surface: {width: '100%'}, faqBar: {flexGrow: 0, maxHeight: 52, marginBottom: 8}, faqContent: {gap: 8, alignItems: 'center'}, faqButton: {backgroundColor: '#FFF', borderColor: '#E6D7C9', borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8}, faqText: {color: '#8A4B2A', fontWeight: '600'}});
