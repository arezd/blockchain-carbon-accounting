import {
    Entity,
    PrimaryColumn,
    Column
} from 'typeorm';

@Entity()
export class Token {
    @PrimaryColumn()
    tokenId!: number;

    @Column()
    tokenTypeId!: number;

    @Column()
    issuee!: string;

    @Column()
    issuer!: string;

    @Column({nullable: true})
    fromDate!: number;

    @Column({nullable: true})
    thruDate!: number;

    @Column({nullable: true})
    dateCreated!: number;

    @Column({type: "hstore", hstoreType:"object", nullable: true})
    metadata!: Object;

    @Column()
    manifest!: string;

    @Column({nullable: true})
    description!: string;

    @Column()
    totalIssued!: number;

    @Column()
    totalRetired!: number;

    @Column({nullable: true})
    scope!: number;

    @Column({nullable: true})
    type!: string;
}
