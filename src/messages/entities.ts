import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export const MESSAGE_CATEGORIES = ['ORDER', 'AFTERSALE', 'MEMBERSHIP', 'SYSTEM'] as const;
export type MessageCategory = typeof MESSAGE_CATEGORIES[number];
export type MessageResource = 'ORDER' | 'AFTERSALE' | 'MEMBERSHIP';

@Entity('user_message_states')
export class UserMessageState {
  @PrimaryColumn({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  // Last assigned sequence, not a global AUTO_INCREMENT: allocated under this user's lock.
  @Column({ name: 'next_sequence', type: 'bigint', unsigned: true, default: '0' }) nextSequence!: string;
  @Column({ type: 'bigint', unsigned: true, default: '0' }) revision!: string;
  @Column({ name: 'unread_count', type: 'int', unsigned: true, default: 0 }) unreadCount!: number;
}

@Entity('user_messages')
@Index('uq_message_user_sequence', ['userId', 'sequence'], { unique: true })
@Index('uq_message_user_event', ['userId', 'eventKey'], { unique: true })
@Index('idx_message_history', ['userId', 'deletedAt', 'sequence'])
@Index('idx_message_unread', ['userId', 'deletedAt', 'readAt', 'sequence'])
export class UserMessage {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id!: string;
  @Column({ name: 'user_id', type: 'varchar', length: 36 }) userId!: string;
  @Column({ type: 'bigint', unsigned: true }) sequence!: string;
  @Column({ name: 'event_key', type: 'varchar', length: 160, select: false }) eventKey!: string;
  @Column({ type: 'varchar', length: 16 }) category!: MessageCategory;
  @Column({ type: 'varchar', length: 120 }) title!: string;
  @Column({ type: 'varchar', length: 2000 }) body!: string;
  @Column({ name: 'resource_type', type: 'varchar', length: 16, nullable: true }) resourceType!: MessageResource | null;
  @Column({ name: 'resource_id', type: 'varchar', length: 36, nullable: true }) resourceId!: string | null;
  @Column({ name: 'read_at', type: 'datetime', precision: 3, nullable: true }) readAt!: Date | null;
  @Column({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true, select: false }) deletedAt!: Date | null;
  @Column({ name: 'created_at', type: 'datetime', precision: 3, default: () => '(UTC_TIMESTAMP(3))' }) createdAt!: Date;
}

export const messageEntities = [UserMessageState, UserMessage];
