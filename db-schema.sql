drop table if exists ByInputUrl;
create table if not exists ByInputUrl (
    InputUrl text not null,
    RequestId text not null primary key
);