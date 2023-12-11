create table if not exists ByInputUrl (
    InputUrl text not null,
    RequestId text not null primary key
);

create table if not exists GenImgResult (
    RequestId text not null,
    ImageType text not null,
    Prompt text not null,
    BucketId text,
    Error text
);

create table if not exists Inputs (
    SourceUrl text not null primary key,
    ContentType text not null,
    BucketId text not null
);